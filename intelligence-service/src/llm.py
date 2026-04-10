from langchain_core.language_models.chat_models import BaseChatModel

from src.config import settings


def get_llm(
    temperature: float | None = None,
    max_tokens: int | None = None,
    **kwargs,
) -> BaseChatModel:
    provider = settings.llm_provider.lower()

    if provider == "anthropic":
        if not settings.anthropic_api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY must be set when LLM_PROVIDER=anthropic"
            )
        from langchain_anthropic import ChatAnthropic

        kwargs.pop("format", None)
        anthropic_kwargs: dict = {
            "model": settings.anthropic_model,
            "api_key": settings.anthropic_api_key,
            "max_tokens": max_tokens if max_tokens is not None else settings.llm_max_tokens,
        }
        if temperature is not None:
            anthropic_kwargs["temperature"] = temperature
        return ChatAnthropic(**anthropic_kwargs, **kwargs)

    from langchain_ollama import ChatOllama

    ollama_kwargs: dict = {
        "model": settings.ollama_model,
        "base_url": settings.ollama_base_url,
    }
    if temperature is not None:
        ollama_kwargs["temperature"] = temperature
    if max_tokens is not None:
        ollama_kwargs["num_predict"] = max_tokens
    return ChatOllama(**ollama_kwargs, **kwargs)


def get_provider_name() -> str:
    provider = settings.llm_provider.lower()
    if provider == "anthropic":
        return "Anthropic"
    return "Ollama"
