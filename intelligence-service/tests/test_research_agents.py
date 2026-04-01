from unittest.mock import AsyncMock, patch

from src.schemas.research import (
    GenerateGoalResponse,
    GenerateTopicResponse,
    ScoreTopicResponse,
    ExpandBulletResponse,
    BulletItem,
)


MOCK_GOAL_RESPONSE = GenerateGoalResponse(
    research_goal="Master refactoring techniques for legacy Java codebases."
)

MOCK_TOPIC_RESPONSE = GenerateTopicResponse(
    title="Refactoring Techniques",
    items=[
        BulletItem(
            id="item-1",
            text="Extract Method",
            explanation="Moving a code fragment into a separate method.",
            completeness="none",
            linked_neuron_ids=[],
            children=[],
        ),
        BulletItem(
            id="item-2",
            text="Inline Method",
            explanation="Replacing a method call with the method body.",
            completeness="partial",
            linked_neuron_ids=["neuron-1"],
            children=[],
        ),
    ],
    overall_completeness="none",
)

MOCK_SCORE_RESPONSE = ScoreTopicResponse(
    items=[
        BulletItem(
            id="item-1",
            text="Extract Method",
            explanation="Moving a code fragment into a separate method.",
            completeness="good",
            linked_neuron_ids=["neuron-1", "neuron-2"],
            children=[],
        ),
    ],
    overall_completeness="good",
)

MOCK_EXPAND_RESPONSE = ExpandBulletResponse(
    children=[
        BulletItem(
            id="item-1-1",
            text="When to extract",
            explanation="Signs that a method is doing too much.",
            completeness="none",
            linked_neuron_ids=[],
            children=[],
        ),
        BulletItem(
            id="item-1-2",
            text="Mechanics",
            explanation="Step-by-step process.",
            completeness="none",
            linked_neuron_ids=[],
            children=[],
        ),
    ]
)


def test_research_goal_generator(client):
    with patch(
        "src.agents.research_goal_generator.invoke_research_goal_generator",
        new_callable=AsyncMock,
        return_value=MOCK_GOAL_RESPONSE,
    ) as mock_fn:
        with patch(
            "src.routers.agents.invoke_research_goal_generator",
            mock_fn,
        ):
            response = client.post(
                "/api/agents/research-goal-generator",
                json={"brain_name": "Spring Security", "neurons": []},
            )

            assert response.status_code == 200
            data = response.json()
            assert "refactoring" in data["research_goal"].lower()


def test_research_topic_generator(client):
    with patch(
        "src.agents.research_topic_generator.invoke_research_topic_generator",
        new_callable=AsyncMock,
        return_value=MOCK_TOPIC_RESPONSE,
    ) as mock_fn:
        with patch(
            "src.routers.agents.invoke_research_topic_generator",
            mock_fn,
        ):
            response = client.post(
                "/api/agents/research-topic-generator",
                json={
                    "prompt": "Refactoring techniques",
                    "context": {
                        "brain_name": "Legacy Systems",
                        "research_goal": "Master legacy modernization",
                        "neurons": [],
                    },
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["title"] == "Refactoring Techniques"
            assert len(data["items"]) == 2
            assert data["items"][0]["text"] == "Extract Method"
            assert data["items"][0]["completeness"] == "none"
            assert data["overall_completeness"] == "none"


def test_research_topic_scorer(client):
    with patch(
        "src.agents.research_topic_scorer.invoke_research_topic_scorer",
        new_callable=AsyncMock,
        return_value=MOCK_SCORE_RESPONSE,
    ) as mock_fn:
        with patch(
            "src.routers.agents.invoke_research_topic_scorer",
            mock_fn,
        ):
            response = client.post(
                "/api/agents/research-topic-scorer",
                json={
                    "items": [
                        {
                            "id": "item-1",
                            "text": "Extract Method",
                            "explanation": "Test",
                            "completeness": "none",
                            "linked_neuron_ids": [],
                            "children": [],
                        }
                    ],
                    "context": {
                        "brain_name": "Legacy Systems",
                        "research_goal": "Master legacy modernization",
                        "neurons": [
                            {
                                "neuron_id": "neuron-1",
                                "title": "Refactoring Notes",
                                "content_preview": "Extract method is useful...",
                            }
                        ],
                    },
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["overall_completeness"] == "good"
            assert data["items"][0]["completeness"] == "good"
            assert "neuron-1" in data["items"][0]["linked_neuron_ids"]


def test_research_bullet_expander(client):
    with patch(
        "src.agents.research_bullet_expander.invoke_research_bullet_expander",
        new_callable=AsyncMock,
        return_value=MOCK_EXPAND_RESPONSE,
    ) as mock_fn:
        with patch(
            "src.routers.agents.invoke_research_bullet_expander",
            mock_fn,
        ):
            response = client.post(
                "/api/agents/research-bullet-expander",
                json={
                    "bullet": {
                        "id": "item-1",
                        "text": "Extract Method",
                        "explanation": "Test",
                        "completeness": "none",
                        "linked_neuron_ids": [],
                        "children": [],
                    },
                    "parent_context": "Refactoring Techniques",
                    "context": {
                        "brain_name": "Legacy Systems",
                        "research_goal": "Master legacy modernization",
                        "neurons": [],
                    },
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data["children"]) == 2
            assert data["children"][0]["text"] == "When to extract"
            assert data["children"][1]["text"] == "Mechanics"
