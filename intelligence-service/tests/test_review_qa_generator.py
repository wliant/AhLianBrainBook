from unittest.mock import AsyncMock, patch

from src.schemas.review_qa import ReviewChoiceOption, ReviewQAItem, ReviewQAResponse


MOCK_QA_RESPONSE = ReviewQAResponse(
    items=[
        ReviewQAItem(
            question="What is the primary purpose of dependency injection?",
            answer="To decouple object creation from usage, making code more testable and modular.",
        ),
        ReviewQAItem(
            question="Name two common types of dependency injection.",
            answer="Constructor injection and setter injection.",
        ),
    ],
    error=None,
)


def test_review_qa_generator(client):
    with patch(
        "src.agents.review_qa_generator.invoke_review_qa_generator",
        new_callable=AsyncMock,
        return_value=MOCK_QA_RESPONSE,
    ) as mock_fn:
        with patch(
            "src.routers.agents.invoke_review_qa_generator",
            mock_fn,
        ):
            response = client.post(
                "/api/agents/review-qa-generator",
                json={
                    "neuron_title": "Dependency Injection",
                    "content_text": "Dependency injection is a design pattern...",
                    "question_count": 2,
                    "brain_name": "Design Patterns",
                    "tags": ["java", "spring"],
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data["items"]) == 2
            assert "dependency injection" in data["items"][0]["question"].lower()
            assert data["error"] is None


def test_review_qa_generator_with_error(client):
    error_response = ReviewQAResponse(items=[], error="Timeout generating questions")
    with patch(
        "src.agents.review_qa_generator.invoke_review_qa_generator",
        new_callable=AsyncMock,
        return_value=error_response,
    ) as mock_fn:
        with patch(
            "src.routers.agents.invoke_review_qa_generator",
            mock_fn,
        ):
            response = client.post(
                "/api/agents/review-qa-generator",
                json={
                    "neuron_title": "Test",
                    "content_text": "Some content",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data["items"]) == 0
            assert data["error"] is not None


def test_review_qa_generator_defaults(client):
    """Test that default values work when optional fields are omitted."""
    with patch(
        "src.agents.review_qa_generator.invoke_review_qa_generator",
        new_callable=AsyncMock,
        return_value=MOCK_QA_RESPONSE,
    ) as mock_fn:
        with patch(
            "src.routers.agents.invoke_review_qa_generator",
            mock_fn,
        ):
            response = client.post(
                "/api/agents/review-qa-generator",
                json={
                    "neuron_title": "Test",
                    "content_text": "Some content",
                },
            )

            assert response.status_code == 200
            # Verify the agent was called with default question_count
            call_args = mock_fn.call_args[0][0]
            assert call_args.question_count == 5
            assert call_args.brain_name == ""
            assert call_args.tags == []


MOCK_CHOICE_RESPONSE = ReviewQAResponse(
    items=[
        ReviewQAItem(
            question="Which injection style is easiest to make immutable?",
            answer="Constructor injection",
            question_type="single_choice",
            choices=[
                ReviewChoiceOption(id="a", text="Constructor injection", correct=True,
                                   rationale="Dependencies can be final",
                                   source_url="https://example.com/di"),
                ReviewChoiceOption(id="b", text="Setter injection",
                                   rationale="Requires mutable fields"),
                ReviewChoiceOption(id="c", text="Field injection via reflection",
                                   rationale="Bypasses the constructor"),
                ReviewChoiceOption(id="d", text="Interface injection callbacks",
                                   rationale="Dependency set after construction"),
            ],
            explanation="Constructor injection lets every dependency be final.",
            researched=True,
        ),
    ],
    error=None,
)


def test_request_defaults_for_choice_fields(client):
    """Callers that omit the new fields get choices on and research off."""
    with patch(
        "src.agents.review_qa_generator.invoke_review_qa_generator",
        new_callable=AsyncMock,
        return_value=MOCK_QA_RESPONSE,
    ) as mock_fn:
        with patch("src.routers.agents.invoke_review_qa_generator", mock_fn):
            response = client.post(
                "/api/agents/review-qa-generator",
                json={"neuron_title": "DI", "content_text": "..."},
            )

    assert response.status_code == 200
    request_arg = mock_fn.call_args[0][0]
    assert request_arg.allow_choice_questions is True
    assert request_arg.tools_enabled is False
    assert request_arg.question_count == 5


def test_choice_fields_are_forwarded(client):
    with patch(
        "src.agents.review_qa_generator.invoke_review_qa_generator",
        new_callable=AsyncMock,
        return_value=MOCK_CHOICE_RESPONSE,
    ) as mock_fn:
        with patch("src.routers.agents.invoke_review_qa_generator", mock_fn):
            response = client.post(
                "/api/agents/review-qa-generator",
                json={
                    "neuron_title": "DI",
                    "content_text": "...",
                    "allow_choice_questions": True,
                    "tools_enabled": True,
                },
            )

    assert response.status_code == 200
    request_arg = mock_fn.call_args[0][0]
    assert request_arg.tools_enabled is True


def test_choice_question_serializes_nested_options(client):
    with patch(
        "src.agents.review_qa_generator.invoke_review_qa_generator",
        new_callable=AsyncMock,
        return_value=MOCK_CHOICE_RESPONSE,
    ) as mock_fn:
        with patch("src.routers.agents.invoke_review_qa_generator", mock_fn):
            response = client.post(
                "/api/agents/review-qa-generator",
                json={"neuron_title": "DI", "content_text": "...", "tools_enabled": True},
            )

    item = response.json()["items"][0]
    assert item["question_type"] == "single_choice"
    assert item["researched"] is True
    assert len(item["choices"]) == 4
    assert [c["correct"] for c in item["choices"]] == [True, False, False, False]
    assert item["choices"][0]["source_url"] == "https://example.com/di"
    assert item["explanation"]


def test_legacy_item_serializes_as_free_text(client):
    """A {question, answer} item keeps the pre-choices contract."""
    with patch(
        "src.agents.review_qa_generator.invoke_review_qa_generator",
        new_callable=AsyncMock,
        return_value=MOCK_QA_RESPONSE,
    ) as mock_fn:
        with patch("src.routers.agents.invoke_review_qa_generator", mock_fn):
            response = client.post(
                "/api/agents/review-qa-generator",
                json={"neuron_title": "DI", "content_text": "..."},
            )

    item = response.json()["items"][0]
    assert item["question_type"] == "free_text"
    assert item["choices"] == []
    assert item["researched"] is False
