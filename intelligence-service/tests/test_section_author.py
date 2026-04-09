import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.schemas.section_author import (
    ConversationTurn,
    NeuronContext,
    QuestionAnswer,
    SectionAuthorRequest,
)

MOCK_CONTEXT = NeuronContext(
    neuron_id="n1",
    neuron_title="Test Neuron",
    section_id="s1",
    brain_name="Test Brain",
    cluster_name="Test Cluster",
    tags=["python", "algorithms"],
    sibling_sections_summary=[],
)


def _make_request(**overrides):
    defaults = {
        "section_type": "code",
        "current_content": None,
        "user_message": "Write a hello world function",
        "conversation_history": [],
        "question_answers": None,
        "regenerate": False,
        "context": MOCK_CONTEXT,
    }
    defaults.update(overrides)
    return SectionAuthorRequest(**defaults)


def _mock_llm_response(content: dict):
    """Create a mock LLM that returns the given dict as JSON."""
    mock_response = MagicMock()
    mock_response.content = json.dumps(content)
    mock_llm = MagicMock()
    mock_llm.invoke.return_value = mock_response
    return mock_llm


class TestSectionAuthorEndpoint:
    def test_questions_flow(self, client):
        llm_output = {
            "action": "questions",
            "questions": [
                {
                    "id": "q1",
                    "text": "Which language?",
                    "input_type": "single-select",
                    "options": ["Python", "JavaScript"],
                }
            ],
            "explanation": "Need to know the language.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ):
            # Reset compiled graph so the patched LLM is used
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request().model_dump(),
                )

        assert response.status_code == 200
        data = response.json()
        assert data["response_type"] == "questions"
        assert len(data["questions"]) == 1
        assert data["questions"][0]["text"] == "Which language?"
        assert data["questions"][0]["input_type"] == "single-select"
        assert data["explanation"] == "Need to know the language."

    def test_content_generation_code(self, client):
        llm_output = {
            "action": "content",
            "section_content": {"code": "def hello():\n    print('hello')", "language": "python"},
            "explanation": "Generated hello world.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request().model_dump(),
                )

        assert response.status_code == 200
        data = response.json()
        assert data["response_type"] == "content"
        assert data["section_content"]["code"] == "def hello():\n    print('hello')"
        assert data["section_content"]["language"] == "python"

    def test_content_generation_math(self, client):
        llm_output = {
            "action": "content",
            "section_content": {"latex": "E = mc^2", "displayMode": True},
            "explanation": "Einstein's equation.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request(section_type="math").model_dump(),
                )

        data = response.json()
        assert data["response_type"] == "content"
        assert data["section_content"]["latex"] == "E = mc^2"

    def test_content_generation_diagram(self, client):
        llm_output = {
            "action": "content",
            "section_content": {"source": "graph TD\n  A-->B", "diagramType": "mermaid"},
            "explanation": "Simple flow.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request(section_type="diagram").model_dump(),
                )

        data = response.json()
        assert data["response_type"] == "content"
        assert data["section_content"]["diagramType"] == "mermaid"

    def test_content_generation_table(self, client):
        llm_output = {
            "action": "content",
            "section_content": {"headers": ["A", "B"], "rows": [["1", "2"]]},
            "explanation": "Simple table.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request(section_type="table").model_dump(),
                )

        data = response.json()
        assert data["response_type"] == "content"
        assert data["section_content"]["headers"] == ["A", "B"]

    def test_content_generation_callout(self, client):
        llm_output = {
            "action": "content",
            "section_content": {"variant": "warning", "text": "Be careful!"},
            "explanation": "Warning callout.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request(section_type="callout").model_dump(),
                )

        data = response.json()
        assert data["response_type"] == "content"
        assert data["section_content"]["variant"] == "warning"

    def test_content_generation_rich_text(self, client):
        llm_output = {
            "action": "content",
            "section_content": {
                "type": "doc",
                "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hello"}]}],
            },
            "explanation": "Simple paragraph.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request(section_type="rich-text").model_dump(),
                )

        data = response.json()
        assert data["response_type"] == "content"
        assert data["section_content"]["type"] == "doc"

    def test_invalid_json_from_llm(self, client):
        mock_response = MagicMock()
        mock_response.content = "not valid json {"
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response

        with patch(
            "src.agents.section_author.get_llm",
            return_value=mock_llm,
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request().model_dump(),
                )

        data = response.json()
        assert data["response_type"] == "message"
        assert data["message_severity"] == "error"
        assert "invalid" in data["message"].lower()

    def test_llm_connection_error(self, client):
        mock_llm = MagicMock()
        mock_llm.invoke.side_effect = ConnectionError("Connection refused")

        with patch(
            "src.agents.section_author.get_llm",
            return_value=mock_llm,
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request().model_dump(),
                )

        data = response.json()
        assert data["response_type"] == "message"
        assert data["message_severity"] == "error"
        assert "cannot connect" in data["message"].lower()

    def test_regenerate_flag(self, client):
        llm_output = {
            "action": "content",
            "section_content": {"code": "# regenerated", "language": "python"},
            "explanation": "Regenerated.",
        }

        mock_llm = _mock_llm_response(llm_output)

        with patch(
            "src.agents.section_author.get_llm",
            return_value=mock_llm,
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request(
                        regenerate=True,
                        user_message="",
                        conversation_history=[
                            ConversationTurn(
                                role="user",
                                content={"type": "text", "text": "Write code"},
                            ),
                            ConversationTurn(
                                role="assistant",
                                content={
                                    "type": "section_content",
                                    "sectionContent": {"code": "# old", "language": "python"},
                                },
                            ),
                        ],
                    ).model_dump(),
                )

        data = response.json()
        assert data["response_type"] == "content"
        # Verify the LLM received intent instructions with previous output
        call_args = mock_llm.invoke.call_args[0][0]
        last_human = [m for m in call_args if hasattr(m, "type") and m.type == "human"][-1]
        assert "substantially different" in last_human.content.lower()
        assert "# old" in last_human.content  # previous output included

    def test_with_question_answers(self, client):
        llm_output = {
            "action": "content",
            "section_content": {"code": "# answered", "language": "python"},
            "explanation": "Based on answers.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request(
                        user_message="",
                        question_answers=[
                            QuestionAnswer(question_id="q1", value="Python"),
                        ],
                        conversation_history=[
                            ConversationTurn(
                                role="user",
                                content={"type": "text", "text": "Write code"},
                            ),
                            ConversationTurn(
                                role="assistant",
                                content={
                                    "type": "questions",
                                    "questions": [
                                        {"id": "q1", "text": "Which lang?", "input_type": "single-select", "options": ["Python", "JS"]},
                                    ],
                                },
                            ),
                        ],
                    ).model_dump(),
                )

        data = response.json()
        assert data["response_type"] == "content"

    def test_code_defaults_filled(self, client):
        """If LLM returns code content without language, defaults are filled."""
        llm_output = {
            "action": "content",
            "section_content": {"code": "print('hi')"},
            "explanation": "Code.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request().model_dump(),
                )

        data = response.json()
        assert data["section_content"]["language"] == "javascript"  # default

    def test_classify_intent_answers_instructs_generation(self, client):
        """When user provides answers, classify_intent tells LLM to generate content."""
        llm_output = {
            "action": "content",
            "section_content": {"code": "# from answers", "language": "python"},
            "explanation": "Generated from answers.",
        }

        mock_llm = _mock_llm_response(llm_output)

        with patch(
            "src.agents.section_author.get_llm",
            return_value=mock_llm,
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request(
                        user_message="",
                        question_answers=[
                            QuestionAnswer(question_id="q1", value="Python"),
                        ],
                        conversation_history=[
                            ConversationTurn(
                                role="user",
                                content={"type": "text", "text": "Write code"},
                            ),
                            ConversationTurn(
                                role="assistant",
                                content={
                                    "type": "questions",
                                    "questions": [
                                        {"id": "q1", "text": "Which lang?", "input_type": "single-select", "options": ["Python", "JS"]},
                                    ],
                                },
                            ),
                        ],
                    ).model_dump(),
                )

        assert response.status_code == 200
        call_args = mock_llm.invoke.call_args[0][0]
        last_human = [m for m in call_args if hasattr(m, "type") and m.type == "human"][-1]
        assert "generate content now" in last_human.content.lower()

    def test_classify_intent_refine_mode(self, client):
        """When user has prior content and sends a message, LLM gets refine instructions."""
        llm_output = {
            "action": "content",
            "section_content": {"code": "# refined", "language": "python"},
            "explanation": "Refined.",
        }

        mock_llm = _mock_llm_response(llm_output)

        with patch(
            "src.agents.section_author.get_llm",
            return_value=mock_llm,
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request(
                        user_message="Make it async",
                        conversation_history=[
                            ConversationTurn(
                                role="user",
                                content={"type": "text", "text": "Write code"},
                            ),
                            ConversationTurn(
                                role="assistant",
                                content={
                                    "type": "section_content",
                                    "sectionContent": {"code": "def hello(): pass", "language": "python"},
                                },
                            ),
                        ],
                    ).model_dump(),
                )

        assert response.status_code == 200
        call_args = mock_llm.invoke.call_args[0][0]
        last_human = [m for m in call_args if hasattr(m, "type") and m.type == "human"][-1]
        assert "targeted modifications" in last_human.content.lower()
        assert "Make it async" in last_human.content

    def test_knowledge_context_in_system_prompt(self, client):
        """Knowledge context from related neurons appears in the system prompt."""
        llm_output = {
            "action": "content",
            "section_content": {"code": "# context-aware", "language": "python"},
            "explanation": "Used context.",
        }

        mock_llm = _mock_llm_response(llm_output)

        context_with_knowledge = MOCK_CONTEXT.model_copy(
            update={
                "knowledge_context": [
                    {
                        "neuron_id": "n2",
                        "title": "Spring Security Config",
                        "content_preview": "Using CSRF protection with Spring Security 6",
                        "tags": ["spring", "security"],
                        "relationship": "linked (references)",
                        "score": 0.95,
                    },
                ],
            }
        )

        with patch(
            "src.agents.section_author.get_llm",
            return_value=mock_llm,
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request(context=context_with_knowledge).model_dump(),
                )

        assert response.status_code == 200
        call_args = mock_llm.invoke.call_args[0][0]
        system_msg = call_args[0]
        assert "Related Knowledge" in system_msg.content
        assert "Spring Security Config" in system_msg.content
        assert "CSRF protection" in system_msg.content

    def test_knowledge_context_empty_backward_compat(self, client):
        """Requests without knowledge_context still work (backward compatibility)."""
        llm_output = {
            "action": "content",
            "section_content": {"code": "print('hi')", "language": "python"},
            "explanation": "Basic.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request().model_dump(),
                )

        assert response.status_code == 200
        data = response.json()
        assert data["response_type"] == "content"

    def test_section_type_aware_code_hint(self, client):
        """Code sections with knowledge context get coding-style hint in instructions."""
        llm_output = {
            "action": "content",
            "section_content": {"code": "# styled", "language": "python"},
            "explanation": "Styled code.",
        }

        mock_llm = _mock_llm_response(llm_output)

        context_with_knowledge = MOCK_CONTEXT.model_copy(
            update={
                "knowledge_context": [
                    {
                        "neuron_id": "n2",
                        "title": "Code Patterns",
                        "content_preview": "We use snake_case",
                        "tags": [],
                        "relationship": "semantically similar",
                        "score": 0.8,
                    },
                ],
            }
        )

        with patch(
            "src.agents.section_author.get_llm",
            return_value=mock_llm,
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request(
                        section_type="code",
                        context=context_with_knowledge,
                    ).model_dump(),
                )

        assert response.status_code == 200
        call_args = mock_llm.invoke.call_args[0][0]
        last_human = [m for m in call_args if hasattr(m, "type") and m.type == "human"][-1]
        assert "coding" in last_human.content.lower() or "code patterns" in last_human.content.lower()

    def test_tools_disabled_uses_json_mode(self, client):
        """When tools_enabled=False, LLM should be called with format='json'."""
        llm_output = {
            "action": "content",
            "section_content": {"code": "print('hi')", "language": "python"},
            "explanation": "No tools.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ) as mock_get_llm:
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request(user_message="Write code").model_dump(),
                )

        assert response.status_code == 200
        # Verify get_llm was called with format="json"
        mock_get_llm.assert_called_with(format="json")

    def test_tools_enabled_prompt_includes_tools_section(self, client):
        """When tools_enabled=True, system prompt should mention available tools."""
        llm_output = {
            "action": "content",
            "section_content": {"code": "print('hi')", "language": "python"},
            "explanation": "With tools.",
        }

        mock_llm = _mock_llm_response(llm_output)
        # bind_tools should return the same mock (tools don't change invoke behavior in test)
        mock_llm.bind_tools = MagicMock(return_value=mock_llm)

        with patch(
            "src.agents.section_author.get_llm",
            return_value=mock_llm,
        ):
            with patch("src.agents.section_author._tool_graph", None):
                with patch("src.agents.section_author._get_tools", return_value=[]):
                    response = client.post(
                        "/api/agents/section-author",
                        json=_make_request(
                            user_message="Write code",
                        ).model_dump() | {"tools_enabled": True},
                    )

        assert response.status_code == 200
        # Verify system prompt includes tools section
        call_args = mock_llm.invoke.call_args[0][0]
        system_msg = call_args[0]
        assert "Available Tools" in system_msg.content

    def test_stream_endpoint_returns_sse(self, client):
        """Stream endpoint returns text/event-stream with stage events."""
        llm_output = {
            "action": "content",
            "section_content": {"code": "print('streamed')", "language": "python"},
            "explanation": "Streamed output.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author/stream",
                    json=_make_request().model_dump(),
                )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        # Parse SSE events from response text
        events = []
        for line in response.text.split("\n"):
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))

        # Should have stage events ending with "complete"
        assert len(events) >= 2
        stages = [e["stage"] for e in events]
        assert "complete" in stages
        # The complete event should have response data
        complete_event = [e for e in events if e["stage"] == "complete"][0]
        assert "data" in complete_event
        assert complete_event["data"]["response_type"] == "content"

    def test_stream_emits_stage_events_in_order(self, client):
        """Stream emits stages in expected order."""
        llm_output = {
            "action": "content",
            "section_content": {"code": "# ordered", "language": "python"},
            "explanation": "Ordered.",
        }

        with patch(
            "src.agents.section_author.get_llm",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._linear_graph", None):
                response = client.post(
                    "/api/agents/section-author/stream",
                    json=_make_request().model_dump(),
                )

        events = []
        for line in response.text.split("\n"):
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))

        stages = [e["stage"] for e in events]
        # Building context should come before generating, which comes before complete
        assert stages.index("building_context") < stages.index("generating")
        assert stages.index("generating") < stages.index("complete")
