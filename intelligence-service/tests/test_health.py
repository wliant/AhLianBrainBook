from unittest.mock import patch


def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["llm_provider"] in ("ollama", "anthropic")
    assert data["llm_status"] in ("ok", "unavailable", "not_configured")


def test_health_anthropic_configured(client):
    with patch("src.routers.health.settings") as mock_settings:
        mock_settings.llm_provider = "anthropic"
        mock_settings.anthropic_api_key = "sk-ant-test"
        response = client.get("/health")
    data = response.json()
    assert data["llm_provider"] == "anthropic"
    assert data["llm_status"] == "ok"


def test_health_anthropic_not_configured(client):
    with patch("src.routers.health.settings") as mock_settings:
        mock_settings.llm_provider = "anthropic"
        mock_settings.anthropic_api_key = ""
        response = client.get("/health")
    data = response.json()
    assert data["llm_provider"] == "anthropic"
    assert data["llm_status"] == "not_configured"
