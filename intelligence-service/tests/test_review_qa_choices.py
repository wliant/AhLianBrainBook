"""Graph-level tests for the choice-generating review Q&A agent.

The LLM is faked and web search is never reached. The module-level compiled graphs are
reset so each test rebuilds against its own patched get_llm.
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.agents import review_qa_generator as agent
from src.schemas.review_qa import ReviewQARequest

DRAFT = {
    "questions": [
        {
            "question": "Which algorithm finds shortest paths with non-negative weights?",
            "answer": "Dijkstra",
            "question_type": "single_choice",
            "confusables": ["Bellman-Ford", "Floyd-Warshall"],
            "research_query": "Dijkstra vs Bellman-Ford negative weights",
        },
        {
            "question": "Why does the priority queue matter?",
            "answer": "It yields the next closest vertex in log time.",
            "question_type": "free_text",
        },
    ]
}

ASSEMBLED = {
    "questions": [
        {
            "question": "Which algorithm finds shortest paths with non-negative weights?",
            "answer": "Dijkstra",
            "question_type": "single_choice",
            "choices": [
                {"text": "Dijkstra's algorithm, using a priority queue", "correct": True,
                 "rationale": "Correct for non-negative weights"},
                {"text": "Bellman-Ford, which tolerates negative edges", "correct": False,
                 "rationale": "True of Bellman-Ford, not Dijkstra",
                 "source_url": "https://example.com/bellman-ford"},
                {"text": "Floyd-Warshall, computing all-pairs paths", "correct": False,
                 "rationale": "All-pairs, not single-source"},
                {"text": "Kruskal's algorithm, building spanning trees", "correct": False,
                 "rationale": "Spanning trees, not paths"},
            ],
            "explanation": "Dijkstra is greedy and needs non-negative weights.",
            "researched": True,
        },
        {
            "question": "Why does the priority queue matter?",
            "answer": "It yields the next closest vertex in log time.",
            "question_type": "free_text",
        },
    ]
}

RESEARCH_BRIEF = {
    "per_question": [
        {
            "index": 0,
            "verified": True,
            "corrected_answer": None,
            "neighbors": [
                {"text": "Bellman-Ford tolerates negative edges",
                 "why_wrong": "different algorithm",
                 "source_url": "https://example.com/bellman-ford"}
            ],
            "sources": ["https://example.com/bellman-ford"],
        }
    ]
}


def _llm_returning(*payloads):
    """A fake LLM that returns each payload in turn across successive invoke() calls."""
    responses = [MagicMock(content=json.dumps(p)) for p in payloads]
    llm = MagicMock()
    llm.invoke.side_effect = responses
    return llm


def _reset_graphs():
    agent._linear_graph = None
    agent._tool_graph = None


@pytest.fixture(autouse=True)
def reset_graph_cache():
    _reset_graphs()
    yield
    _reset_graphs()


def _request(**kw):
    return ReviewQARequest(
        neuron_title="Shortest paths",
        content_text="Dijkstra's algorithm computes single-source shortest paths. " * 5,
        question_count=5,
        **kw,
    )


class TestLinearPath:
    """tools_enabled=False — choices still generated, but unresearched."""

    @pytest.mark.asyncio
    async def test_produces_a_mixed_set_of_choice_and_free_text(self):
        with patch.object(agent, "get_llm", return_value=_llm_returning(DRAFT, ASSEMBLED)):
            result = await agent.invoke_review_qa_generator(_request(tools_enabled=False))

        assert result.error is None
        assert [i.question_type for i in result.items] == ["single_choice", "free_text"]
        mc = result.items[0]
        assert len(mc.choices) == 4
        assert sum(1 for c in mc.choices if c.correct) == 1
        assert [c.id for c in mc.choices] == ["a", "b", "c", "d"]
        assert mc.explanation

    @pytest.mark.asyncio
    async def test_never_calls_web_search(self):
        with patch.object(agent, "get_llm", return_value=_llm_returning(DRAFT, ASSEMBLED)):
            with patch.object(agent, "_get_tools") as tools:
                await agent.invoke_review_qa_generator(_request(tools_enabled=False))
        tools.assert_not_called()

    @pytest.mark.asyncio
    async def test_answer_is_the_correct_option_text(self):
        with patch.object(agent, "get_llm", return_value=_llm_returning(DRAFT, ASSEMBLED)):
            result = await agent.invoke_review_qa_generator(_request(tools_enabled=False))
        assert result.items[0].answer == "Dijkstra's algorithm, using a priority queue"


class TestToolPath:
    @pytest.mark.asyncio
    async def test_research_brief_feeds_the_assembled_choices(self):
        react = MagicMock()
        react.ainvoke = AsyncMock(return_value={
            "messages": [MagicMock(content=json.dumps(RESEARCH_BRIEF))]
        })
        with patch.object(agent, "get_llm", return_value=_llm_returning(DRAFT, ASSEMBLED)):
            with patch.object(agent, "_get_tools", return_value=[]):
                with patch("langgraph.prebuilt.create_react_agent", return_value=react):
                    result = await agent.invoke_review_qa_generator(_request(tools_enabled=True))

        assert result.error is None
        react.ainvoke.assert_awaited_once()
        mc = result.items[0]
        assert mc.researched is True
        assert any(c.source_url for c in mc.choices)

    @pytest.mark.asyncio
    async def test_research_failure_degrades_instead_of_failing(self):
        react = MagicMock()
        react.ainvoke = AsyncMock(side_effect=RuntimeError("network down"))
        unresearched = json.loads(json.dumps(ASSEMBLED))
        unresearched["questions"][0]["researched"] = False
        for choice in unresearched["questions"][0]["choices"]:
            choice.pop("source_url", None)

        with patch.object(agent, "get_llm", return_value=_llm_returning(DRAFT, unresearched)):
            with patch.object(agent, "_get_tools", return_value=[]):
                with patch("langgraph.prebuilt.create_react_agent", return_value=react):
                    result = await agent.invoke_review_qa_generator(_request(tools_enabled=True))

        assert result.error is None
        assert result.items[0].question_type == "single_choice"
        assert result.items[0].researched is False

    @pytest.mark.asyncio
    async def test_a_hanging_research_stage_degrades_on_timeout(self):
        """The DuckDuckGo fallback can hang, so research must not block generation."""
        async def never_returns(*_args, **_kwargs):
            await asyncio.sleep(60)

        react = MagicMock()
        react.ainvoke = never_returns

        with patch.object(agent, "RESEARCH_TIMEOUT_SECONDS", 0.05):
            with patch.object(agent, "get_llm", return_value=_llm_returning(DRAFT, ASSEMBLED)):
                with patch.object(agent, "_get_tools", return_value=[]):
                    with patch("langgraph.prebuilt.create_react_agent", return_value=react):
                        result = await agent.invoke_review_qa_generator(_request(tools_enabled=True))

        assert result.error is None
        assert len(result.items) == 2
        assert result.items[0].question_type == "single_choice"

    @pytest.mark.asyncio
    async def test_unparseable_brief_still_yields_questions(self):
        react = MagicMock()
        react.ainvoke = AsyncMock(return_value={"messages": [MagicMock(content="not json at all")]})
        with patch.object(agent, "get_llm", return_value=_llm_returning(DRAFT, ASSEMBLED)):
            with patch.object(agent, "_get_tools", return_value=[]):
                with patch("langgraph.prebuilt.create_react_agent", return_value=react):
                    result = await agent.invoke_review_qa_generator(_request(tools_enabled=True))
        assert result.error is None
        assert len(result.items) == 2


class TestChoicesDisabled:
    @pytest.mark.asyncio
    async def test_free_text_only_skips_research_and_assembly(self):
        legacy = {"questions": [
            {"question": "What is Dijkstra for?", "answer": "Shortest paths."},
            {"question": "Why non-negative?", "answer": "Greedy choice must stay valid."},
        ]}
        llm = _llm_returning(legacy)
        with patch.object(agent, "get_llm", return_value=llm):
            result = await agent.invoke_review_qa_generator(
                _request(tools_enabled=True, allow_choice_questions=False))

        assert result.error is None
        assert all(i.question_type == "free_text" for i in result.items)
        assert all(i.choices == [] for i in result.items)
        # Only the draft call happened — no assembly round trip.
        assert llm.invoke.call_count == 1


class TestFailureModes:
    @pytest.mark.asyncio
    async def test_unparseable_draft_returns_an_error(self):
        llm = MagicMock()
        llm.invoke.return_value = MagicMock(content="}{ not json")
        with patch.object(agent, "get_llm", return_value=llm):
            result = await agent.invoke_review_qa_generator(_request())
        assert result.items == []
        assert "Invalid JSON" in result.error

    @pytest.mark.asyncio
    async def test_assembly_failure_falls_back_to_free_text(self):
        llm = MagicMock()
        llm.invoke.side_effect = [
            MagicMock(content=json.dumps(DRAFT)),
            MagicMock(content="garbage"),
        ]
        with patch.object(agent, "get_llm", return_value=llm):
            result = await agent.invoke_review_qa_generator(_request())
        assert result.error is None
        assert all(i.question_type == "free_text" for i in result.items)
