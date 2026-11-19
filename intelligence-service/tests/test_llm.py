from unittest.mock import patch

import pytest

from src.llm import get_llm, get_provider_name


class TestGetLlm:
    def test_default_returns_ollama(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "ollama"
            mock_settings.ollama_model = "llama3.2"
            mock_settings.ollama_base_url = "http://localhost:11434"
            llm = get_llm()
        assert type(llm).__name__ == "ChatOllama"

    def test_anthropic_returns_chat_anthropic(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.anthropic_api_key = "sk-ant-test"
            mock_settings.anthropic_model = "claude-sonnet-4-6"
            llm = get_llm()
        assert type(llm).__name__ == "ChatAnthropic"

    def test_anthropic_without_key_raises(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.anthropic_api_key = ""
            with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
                get_llm()

    def test_format_kwarg_stripped_for_anthropic(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.anthropic_api_key = "sk-ant-test"
            mock_settings.anthropic_model = "claude-sonnet-4-6"
            llm = get_llm(format="json")
        assert type(llm).__name__ == "ChatAnthropic"

    def test_format_kwarg_passed_for_ollama(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "ollama"
            mock_settings.ollama_model = "llama3.2"
            mock_settings.ollama_base_url = "http://localhost:11434"
            llm = get_llm(format="json")
        assert type(llm).__name__ == "ChatOllama"


    def test_temperature_passed_to_ollama(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "ollama"
            mock_settings.ollama_model = "llama3.2"
            mock_settings.ollama_base_url = "http://localhost:11434"
            llm = get_llm(temperature=0.3)
        assert llm.temperature == 0.3

    def test_temperature_passed_to_anthropic_on_older_models(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.anthropic_api_key = "sk-ant-test"
            mock_settings.anthropic_model = "claude-sonnet-4-6"
            llm = get_llm(temperature=0.1)
        assert llm.temperature == 0.1

    def test_max_tokens_passed_to_ollama_as_num_predict(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "ollama"
            mock_settings.ollama_model = "llama3.2"
            mock_settings.ollama_base_url = "http://localhost:11434"
            llm = get_llm(max_tokens=1024)
        assert llm.num_predict == 1024

    def test_max_tokens_overrides_default_for_anthropic(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.anthropic_api_key = "sk-ant-test"
            mock_settings.anthropic_model = "claude-sonnet-4-6"
            mock_settings.llm_max_tokens = 4096
            llm = get_llm(max_tokens=256)
        assert llm.max_tokens == 256

    def test_anthropic_uses_default_max_tokens_when_none(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.anthropic_api_key = "sk-ant-test"
            mock_settings.anthropic_model = "claude-sonnet-4-6"
            mock_settings.llm_max_tokens = 4096
            llm = get_llm()
        assert llm.max_tokens == 4096

    def test_ollama_no_num_predict_when_max_tokens_none(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "ollama"
            mock_settings.ollama_model = "llama3.2"
            mock_settings.ollama_base_url = "http://localhost:11434"
            llm = get_llm()
        assert not hasattr(llm, "num_predict") or llm.num_predict is None


class TestGetProviderName:
    def test_ollama_name(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "ollama"
            assert get_provider_name() == "Ollama"

    def test_anthropic_name(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            assert get_provider_name() == "Anthropic"


class TestSamplingParamGuard:
    """Claude 5 and Opus 4.7+ reject non-default temperature/top_p/top_k with a 400."""

    def _llm(self, model, **kwargs):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.anthropic_api_key = "sk-ant-test"
            mock_settings.anthropic_model = model
            mock_settings.llm_max_tokens = 8192
            return get_llm(**kwargs)

    @pytest.mark.parametrize("model", [
        "claude-sonnet-5",
        "claude-opus-5",
        "claude-opus-4-8",
        "claude-opus-4-7",
        "claude-fable-5",
    ])
    def test_temperature_dropped_on_models_that_reject_it(self, model):
        llm = self._llm(model, temperature=0.4)
        assert llm.temperature is None

    @pytest.mark.parametrize("model", ["claude-sonnet-4-6", "claude-haiku-4-5"])
    def test_temperature_kept_on_models_that_accept_it(self, model):
        assert self._llm(model, temperature=0.4).temperature == 0.4

    def test_dated_snapshot_ids_are_matched_by_prefix(self):
        assert self._llm("claude-sonnet-5-20260101", temperature=0.4).temperature is None

    def test_ollama_keeps_temperature_regardless(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "ollama"
            mock_settings.ollama_model = "llama3.2"
            mock_settings.ollama_base_url = "http://localhost:11434"
            assert get_llm(temperature=0.4).temperature == 0.4


class TestEffort:
    def _llm(self, **kwargs):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            mock_settings.anthropic_api_key = "sk-ant-test"
            mock_settings.anthropic_model = "claude-sonnet-5"
            mock_settings.llm_max_tokens = 8192
            return get_llm(**kwargs)

    def test_effort_is_forwarded(self):
        assert self._llm(effort="low").effort == "low"

    def test_effort_defaults_to_unset(self):
        assert self._llm().effort is None

    def test_effort_is_not_sent_to_ollama(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "ollama"
            mock_settings.ollama_model = "llama3.2"
            mock_settings.ollama_base_url = "http://localhost:11434"
            llm = get_llm(effort="low")
        assert type(llm).__name__ == "ChatOllama"
