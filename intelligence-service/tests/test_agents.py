from unittest.mock import AsyncMock, patch


def test_invoke_agent_returns_response(client):
    with patch(
        "src.agents.placeholder.invoke_placeholder_agent",
        new_callable=AsyncMock,
        return_value="Hello from the agent!",
    ) as mock_agent:
        # Patch the registry to point to our mock
        with patch.dict(
            "src.routers.agents.AGENT_REGISTRY",
            {"placeholder": mock_agent},
        ):
            response = client.post(
                "/api/agents/invoke",
                json={"input": "Hello", "agent_type": "placeholder"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["output"] == "Hello from the agent!"
            assert data["agent_type"] == "placeholder"
            mock_agent.assert_called_once_with("Hello")


def test_invoke_agent_with_unknown_type(client):
    response = client.post(
        "/api/agents/invoke",
        json={"input": "Hello", "agent_type": "nonexistent"},
    )
    assert response.status_code == 400
    assert "nonexistent" in response.json()["detail"]
