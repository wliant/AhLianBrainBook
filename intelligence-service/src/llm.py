from langchain_core.language_models.chat_models import BaseChatModel

from src.config import settings


def get_llm(**kwargs) -> BaseChatModel:
    provider = settings.llm_provider.lower()

    if provider == "anthropic":
        if not settings.anthropic_api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY must be set when LLM_PROVIDER=anthropic"
            )
        from langchain_anthropic import ChatAnthropic

        kwargs.pop("format", None)
        return ChatAnthropic(
            model=settings.anthropic_model,
            api_key=settings.anthropic_api_key,
            **kwargs,
        )

    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=settings.ollama_model,
        base_url=settings.ollama_base_url,
        **kwargs,
    )


def get_provider_name() -> str:
    provider = settings.llm_provider.lower()
    if provider == "anthropic":
        return "Anthropic"
    return "Ollama"
