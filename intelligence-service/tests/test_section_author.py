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
            "src.agents.section_author.ChatOllama",
            return_value=_mock_llm_response(llm_output),
        ):
            # Reset compiled graph so the patched LLM is used
            with patch("src.agents.section_author._compiled_graph", None):
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
            "src.agents.section_author.ChatOllama",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._compiled_graph", None):
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
            "src.agents.section_author.ChatOllama",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._compiled_graph", None):
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
            "src.agents.section_author.ChatOllama",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._compiled_graph", None):
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
            "src.agents.section_author.ChatOllama",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._compiled_graph", None):
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
            "src.agents.section_author.ChatOllama",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._compiled_graph", None):
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
            "src.agents.section_author.ChatOllama",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._compiled_graph", None):
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
            "src.agents.section_author.ChatOllama",
            return_value=mock_llm,
        ):
            with patch("src.agents.section_author._compiled_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request().model_dump(),
                )

        data = response.json()
        assert data["response_type"] == "message"
        assert data["message_severity"] == "error"
        assert "invalid" in data["message"].lower()

    def test_ollama_connection_error(self, client):
        mock_llm = MagicMock()
        mock_llm.invoke.side_effect = ConnectionError("Connection refused")

        with patch(
            "src.agents.section_author.ChatOllama",
            return_value=mock_llm,
        ):
            with patch("src.agents.section_author._compiled_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request().model_dump(),
                )

        data = response.json()
        assert data["response_type"] == "message"
        assert data["message_severity"] == "error"
        assert "ollama" in data["message"].lower()

    def test_regenerate_flag(self, client):
        llm_output = {
            "action": "content",
            "section_content": {"code": "# regenerated", "language": "python"},
            "explanation": "Regenerated.",
        }

        mock_llm = _mock_llm_response(llm_output)

        with patch(
            "src.agents.section_author.ChatOllama",
            return_value=mock_llm,
        ):
            with patch("src.agents.section_author._compiled_graph", None):
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
        # Verify the LLM received a regenerate message
        call_args = mock_llm.invoke.call_args[0][0]
        last_human = [m for m in call_args if hasattr(m, "type") and m.type == "human"][-1]
        assert "regenerate" in last_human.content.lower()

    def test_with_question_answers(self, client):
        llm_output = {
            "action": "content",
            "section_content": {"code": "# answered", "language": "python"},
            "explanation": "Based on answers.",
        }

        with patch(
            "src.agents.section_author.ChatOllama",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._compiled_graph", None):
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
            "src.agents.section_author.ChatOllama",
            return_value=_mock_llm_response(llm_output),
        ):
            with patch("src.agents.section_author._compiled_graph", None):
                response = client.post(
                    "/api/agents/section-author",
                    json=_make_request().model_dump(),
                )

        data = response.json()
        assert data["section_content"]["language"] == "javascript"  # default
