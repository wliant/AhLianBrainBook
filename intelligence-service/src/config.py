from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_provider: str = "ollama"
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "llama3.2"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5"
    embedding_ollama_base_url: str = "http://ollama:11434"
    embedding_ollama_model: str = "nomic-embed-text"
    brainbook_api_url: str = "http://app:8080"
    # Claude 5 runs adaptive thinking by default and max_tokens covers thinking +
    # answer, so this ceiling is larger than the thinking-off equivalent was.
    llm_max_tokens: int = 8192
    agent_timeout: int = 600
    log_level: str = "INFO"
    tavily_api_key: str = ""
    internal_api_key: str = ""

    # Per-agent LLM tuning. Ignored on Claude 5 models, which reject sampling
    # parameters — use the effort settings below instead.
    temperature_goal_generator: float = 0.7
    temperature_topic_generator: float = 0.4
    temperature_topic_scorer: float = 0.1
    temperature_bullet_expander: float = 0.4
    temperature_review_qa: float = 0.4
    temperature_review_qa_choices: float = 0.3

    # Per-agent max tokens. Raised for adaptive thinking, which shares this budget
    # with the answer.
    max_tokens_goal_generator: int = 4096
    max_tokens_topic_generator: int = 16000
    max_tokens_topic_scorer: int = 8192
    max_tokens_bullet_expander: int = 8192
    # 10 questions x 5 options x rationale, plus thinking, overflows the default.
    max_tokens_review_qa: int = 16000

    # Reasoning effort on models that support it (low/medium/high/xhigh/max). This is the
    # cost lever that replaces temperature on Claude 5; "high" is the API default.
    effort_goal_generator: str = "low"
    effort_topic_scorer: str = "low"
    effort_review_qa: str = "medium"
    effort_review_qa_choices: str = "high"


settings = Settings()
