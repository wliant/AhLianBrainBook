from unittest.mock import AsyncMock, patch

from src.schemas.review_qa import ReviewQAResponse, ReviewQAItem


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
