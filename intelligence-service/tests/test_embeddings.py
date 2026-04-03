from unittest.mock import AsyncMock, patch


def test_compute_embedding_returns_vector(client):
    mock_vector = [0.1] * 1024
    with patch("src.routers.embeddings.get_embeddings") as mock_get:
        mock_embeddings = mock_get.return_value
        mock_embeddings.aembed_query = AsyncMock(return_value=mock_vector)

        response = client.post("/api/embeddings", json={"text": "hello world"})

    assert response.status_code == 200
    data = response.json()
    assert data["dimensions"] == 1024
    assert len(data["embedding"]) == 1024
    assert data["model_name"] == "nomic-embed-text"


def test_compute_embedding_empty_text_returns_400(client):
    response = client.post("/api/embeddings", json={"text": "   "})
    assert response.status_code == 400


def test_compute_embedding_missing_text_returns_422(client):
    response = client.post("/api/embeddings", json={})
    assert response.status_code == 422
