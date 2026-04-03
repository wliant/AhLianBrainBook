from langchain_ollama import OllamaEmbeddings

from src.config import settings


def get_embeddings() -> OllamaEmbeddings:
    return OllamaEmbeddings(
        model=settings.embedding_ollama_model,
        base_url=settings.embedding_ollama_base_url,
    )
