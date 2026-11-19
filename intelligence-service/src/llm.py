import logging

from langchain_core.language_models.chat_models import BaseChatModel

from src.config import settings

logger = logging.getLogger(__name__)

# Claude 5 and Opus 4.7+ reject non-default temperature/top_p/top_k with a 400, and run
# adaptive thinking instead. Matched as prefixes so dated snapshots are covered too.
_NO_SAMPLING_PARAMS = (
    "claude-fable-5",
    "claude-mythos-5",
    "claude-opus-5",
    "claude-opus-4-8",
    "claude-opus-4-7",
    "claude-sonnet-5",
)


def _rejects_sampling_params(model: str) -> bool:
    return any(model.startswith(prefix) for prefix in _NO_SAMPLING_PARAMS)


def get_llm(
    temperature: float | None = None,
    max_tokens: int | None = None,
    effort: str | None = None,
    **kwargs,
) -> BaseChatModel:
    """Build the configured chat model.

    `temperature` is honoured on Ollama and on older Claude models; on models that reject
    sampling parameters it is dropped and `effort` is the equivalent lever (low/medium/
    high/xhigh/max) for trading cost against reasoning depth.
    """
    provider = settings.llm_provider.lower()

    if provider == "anthropic":
        if not settings.anthropic_api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY must be set when LLM_PROVIDER=anthropic"
            )
        from langchain_anthropic import ChatAnthropic

        kwargs.pop("format", None)
        model = settings.anthropic_model
        anthropic_kwargs: dict = {
            "model": model,
            "api_key": settings.anthropic_api_key,
            # With adaptive thinking on, max_tokens covers thinking + answer, so this
            # needs enough headroom for both.
            "max_tokens": max_tokens if max_tokens is not None else settings.llm_max_tokens,
        }
        if temperature is not None:
            if _rejects_sampling_params(model):
                logger.debug("Dropping temperature=%s; %s rejects sampling params", temperature, model)
            else:
                anthropic_kwargs["temperature"] = temperature
        if effort is not None:
            anthropic_kwargs["effort"] = effort
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
