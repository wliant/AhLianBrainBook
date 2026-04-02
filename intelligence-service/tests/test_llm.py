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
            mock_settings.anthropic_model = "claude-sonnet-4-20250514"
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
            mock_settings.anthropic_model = "claude-sonnet-4-20250514"
            llm = get_llm(format="json")
        assert type(llm).__name__ == "ChatAnthropic"

    def test_format_kwarg_passed_for_ollama(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "ollama"
            mock_settings.ollama_model = "llama3.2"
            mock_settings.ollama_base_url = "http://localhost:11434"
            llm = get_llm(format="json")
        assert type(llm).__name__ == "ChatOllama"


class TestGetProviderName:
    def test_ollama_name(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "ollama"
            assert get_provider_name() == "Ollama"

    def test_anthropic_name(self):
        with patch("src.llm.settings") as mock_settings:
            mock_settings.llm_provider = "anthropic"
            assert get_provider_name() == "Anthropic"
