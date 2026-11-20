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


def _free_text(question):
    return {"question": question, "answer": "A", "question_type": "free_text",
            "choices": [], "explanation": "", "researched": False}


def _request(**kw):
    return ReviewQARequest(
        neuron_title="Shortest paths",
        content_text="Dijkstra's algorithm computes single-source shortest paths. " * 5,
        **{"question_count": 5, **kw},
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
            # question_count matches the stub's output so no top-up round is triggered.
            result = await agent.invoke_review_qa_generator(
                _request(tools_enabled=True, question_mode="free_text", question_count=2))

        assert result.error is None
        assert all(i.question_type == "free_text" for i in result.items)
        assert all(i.choices == [] for i in result.items)
        # Only the draft call happened — no assembly round trip.
        assert llm.invoke.call_count == 1


class TestChoiceOnly:
    """question_mode="choice_only" — free-text questions must not survive."""

    @pytest.mark.asyncio
    async def test_drops_free_text_from_the_assembled_set(self):
        # ASSEMBLED carries one choice question and one free-text question.
        with patch.object(agent, "get_llm", return_value=_llm_returning(DRAFT, ASSEMBLED)):
            result = await agent.invoke_review_qa_generator(
                _request(tools_enabled=False, question_mode="choice_only"))

        assert result.error is None
        assert [i.question_type for i in result.items] == ["single_choice"]

    @pytest.mark.asyncio
    async def test_draft_prompt_over_generates_and_forbids_free_text(self):
        llm = _llm_returning(DRAFT, ASSEMBLED)
        with patch.object(agent, "get_llm", return_value=llm):
            await agent.invoke_review_qa_generator(
                _request(tools_enabled=False, question_mode="choice_only"))

        prompt = llm.invoke.call_args_list[0][0][0][0].content
        # 5 requested, over-drafted by CHOICE_ONLY_OVERDRAFT to absorb rejections.
        assert "Number of questions to generate: 7" in prompt
        assert "Do NOT use free_text" in prompt

    @pytest.mark.asyncio
    async def test_assembly_failure_yields_nothing_rather_than_free_text(self):
        llm = MagicMock()
        llm.invoke.side_effect = [
            MagicMock(content=json.dumps(DRAFT)),
            MagicMock(content="garbage"),
        ]
        with patch.object(agent, "get_llm", return_value=llm):
            result = await agent.invoke_review_qa_generator(
                _request(question_mode="choice_only"))

        assert result.items == []
        assert result.error


class TestBatching:
    @pytest.mark.asyncio
    async def test_counts_up_to_a_batch_run_once(self):
        llm = _llm_returning(DRAFT, ASSEMBLED)
        with patch.object(agent, "get_llm", return_value=llm):
            # The stub yields 2 questions; asking for 2 keeps this to a single round.
            result = await agent.invoke_review_qa_generator(_request(question_count=2))

        assert result.error is None
        # Draft + assemble, once — no batching overhead for small counts.
        assert llm.invoke.call_count == 2

    def test_split_batches_spreads_evenly(self):
        assert agent._split_batches(5) == [5]
        assert agent._split_batches(10) == [10]
        assert agent._split_batches(20) == [10, 10]
        assert agent._split_batches(50) == [10, 10, 10, 10, 10]
        # 25 would otherwise leave a 5-question runt.
        assert agent._split_batches(25) == [9, 8, 8]

    @pytest.mark.asyncio
    async def test_large_count_runs_one_graph_pass_per_batch(self):
        calls = []

        async def fake_ainvoke(state):
            calls.append(state)
            index = state["batch_index"]
            return {"items": [
                {"question": f"Q{index}-{n}", "answer": "A",
                 "question_type": "free_text", "choices": [], "explanation": "",
                 "researched": False}
                for n in range(state["question_count"])
            ], "error": None}

        graph = MagicMock()
        graph.ainvoke = fake_ainvoke
        with patch.object(agent, "_get_graph", return_value=graph):
            result = await agent.invoke_review_qa_generator(_request(question_count=20))

        assert [c["batch_index"] for c in calls] == [0, 1]
        assert all(c["batch_total"] == 2 for c in calls)
        assert len(result.items) == 20

    @pytest.mark.asyncio
    async def test_merge_drops_questions_repeated_across_batches(self):
        async def fake_ainvoke(state):
            # Both batches return the same two questions.
            return {"items": [
                {"question": "What is Dijkstra for?", "answer": "Shortest paths",
                 "question_type": "free_text", "choices": [], "explanation": "",
                 "researched": False},
                {"question": "What is Dijkstra for?!", "answer": "Shortest paths",
                 "question_type": "free_text", "choices": [], "explanation": "",
                 "researched": False},
            ], "error": None}

        graph = MagicMock()
        graph.ainvoke = fake_ainvoke
        with patch.object(agent, "_get_graph", return_value=graph):
            result = await agent.invoke_review_qa_generator(_request(question_count=20))

        # Punctuation-only variants normalize to the same key.
        assert len(result.items) == 1

    @pytest.mark.asyncio
    async def test_one_failed_batch_still_returns_the_others(self):
        async def fake_ainvoke(state):
            if state["batch_index"] == 0:
                raise RuntimeError("provider exploded")
            return {"items": [
                {"question": "Survivor", "answer": "A", "question_type": "free_text",
                 "choices": [], "explanation": "", "researched": False}
            ], "error": None}

        graph = MagicMock()
        graph.ainvoke = fake_ainvoke
        with patch.object(agent, "_get_graph", return_value=graph):
            result = await agent.invoke_review_qa_generator(_request(question_count=20))

        assert result.error is None
        assert [i.question for i in result.items] == ["Survivor"]

    @pytest.mark.asyncio
    async def test_all_batches_failing_is_an_error(self):
        async def fake_ainvoke(state):
            raise RuntimeError("provider exploded")

        graph = MagicMock()
        graph.ainvoke = fake_ainvoke
        with patch.object(agent, "_get_graph", return_value=graph):
            result = await agent.invoke_review_qa_generator(_request(question_count=20))

        assert result.items == []
        assert "provider exploded" in result.error


class TestTopUp:
    """A short round is refilled once, with the questions already held excluded."""

    @pytest.mark.asyncio
    async def test_refills_a_shortfall_and_passes_an_avoid_list(self):
        rounds = []

        async def fake_ainvoke(state):
            rounds.append(state)
            # First round yields 6 of the 10 asked for; the top-up supplies the rest.
            if not state["avoid_questions"]:
                return {"items": [_free_text(f"First {n}") for n in range(3)], "error": None}
            return {"items": [_free_text(f"Second {n}") for n in range(2)], "error": None}

        graph = MagicMock()
        graph.ainvoke = fake_ainvoke
        with patch.object(agent, "_get_graph", return_value=graph):
            result = await agent.invoke_review_qa_generator(_request(question_count=10))

        assert len(rounds) == 2
        assert sorted(rounds[1]["avoid_questions"]) == ["First 0", "First 1", "First 2"]
        assert len(result.items) == 5

    @pytest.mark.asyncio
    async def test_does_not_top_up_when_only_one_question_is_missing(self):
        async def fake_ainvoke(state):
            return {"items": [_free_text(f"Q{n}") for n in range(9)], "error": None}

        graph = MagicMock()
        graph.ainvoke = fake_ainvoke
        calls = []
        with patch.object(agent, "_get_graph", return_value=graph):
            graph.ainvoke = lambda state: (calls.append(state), fake_ainvoke(state))[1]
            result = await agent.invoke_review_qa_generator(_request(question_count=10))

        assert len(calls) == 1
        assert len(result.items) == 9

    @pytest.mark.asyncio
    async def test_tops_up_only_once(self):
        calls = []

        async def fake_ainvoke(state):
            calls.append(state)
            return {"items": [_free_text("Only one")], "error": None}

        graph = MagicMock()
        graph.ainvoke = fake_ainvoke
        with patch.object(agent, "_get_graph", return_value=graph):
            result = await agent.invoke_review_qa_generator(_request(question_count=10))

        # One initial round plus exactly one top-up, despite still being short.
        assert len(calls) == 2
        assert len(result.items) == 1


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
