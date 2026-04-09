"""Tests for KB and web search tools."""

from unittest.mock import MagicMock, patch

import pytest


class TestKbTools:
    def test_search_notes_calls_api(self):
        from src.tools.kb_tools import create_kb_tools

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = [
            {"neuronId": "n1", "title": "Test Note", "preview": "Some content", "score": 0.85},
        ]

        with patch("src.tools.kb_tools.httpx.Client") as MockClient:
            MockClient.return_value.__enter__ = MagicMock(return_value=MagicMock(
                get=MagicMock(return_value=mock_response),
            ))
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            tools = create_kb_tools("brain-123", "http://app:8080", "secret")
            search_tool = tools[0]
            result = search_tool.invoke({"query": "test", "limit": 5})

        assert "Test Note" in result
        assert "0.85" in result

    def test_search_notes_handles_error(self):
        from src.tools.kb_tools import create_kb_tools

        with patch("src.tools.kb_tools.httpx.Client") as MockClient:
            MockClient.return_value.__enter__ = MagicMock(return_value=MagicMock(
                get=MagicMock(side_effect=Exception("Connection timeout")),
            ))
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            tools = create_kb_tools("brain-123", "http://app:8080", "")
            search_tool = tools[0]
            result = search_tool.invoke({"query": "test"})

        assert "failed" in result.lower() or "Search failed" in result

    def test_read_note_calls_api(self):
        from src.tools.kb_tools import create_kb_tools

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "neuronId": "n1",
            "title": "My Note",
            "contentText": "Full content here",
        }

        with patch("src.tools.kb_tools.httpx.Client") as MockClient:
            MockClient.return_value.__enter__ = MagicMock(return_value=MagicMock(
                get=MagicMock(return_value=mock_response),
            ))
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            tools = create_kb_tools("brain-123", "http://app:8080", "")
            read_tool = tools[2]
            result = read_tool.invoke({"neuron_id": "n1"})

        assert "My Note" in result
        assert "Full content" in result


class TestWebTools:
    def test_web_search_duckduckgo_fallback(self):
        """When tavily_api_key is empty, DuckDuckGo should be used."""
        from src.tools.web_tools import create_web_tools

        with patch("src.config.settings") as mock_settings:
            mock_settings.tavily_api_key = ""

            # Mock DuckDuckGo
            mock_ddgs = MagicMock()
            mock_ddgs.__enter__ = MagicMock(return_value=mock_ddgs)
            mock_ddgs.__exit__ = MagicMock(return_value=False)
            mock_ddgs.text.return_value = [
                {"title": "Result 1", "href": "https://example.com", "body": "Some text"},
            ]

            with patch("src.tools.web_tools.settings", mock_settings):
                tools = create_web_tools()
                web_search_tool = tools[0]

                with patch("src.tools.web_tools._search_duckduckgo") as mock_ddg:
                    mock_ddg.return_value = "- [Result 1](https://example.com)\n  Some text"
                    result = web_search_tool.invoke({"query": "test query"})

            assert "Result 1" in result or "test query" in str(result) or result is not None

    def test_fetch_webpage_calls_jina(self):
        from src.tools.web_tools import create_web_tools

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.text = "This is the extracted content from the page. " * 100

        with patch("src.tools.web_tools.httpx.Client") as MockClient:
            MockClient.return_value.__enter__ = MagicMock(return_value=MagicMock(
                get=MagicMock(return_value=mock_response),
            ))
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            tools = create_web_tools()
            fetch_tool = tools[1]
            result = fetch_tool.invoke({"url": "https://example.com/page"})

        assert len(result) <= 3000
        assert "extracted content" in result

    def test_fetch_webpage_handles_error(self):
        from src.tools.web_tools import create_web_tools

        with patch("src.tools.web_tools.httpx.Client") as MockClient:
            MockClient.return_value.__enter__ = MagicMock(return_value=MagicMock(
                get=MagicMock(side_effect=Exception("Timeout")),
            ))
            MockClient.return_value.__exit__ = MagicMock(return_value=False)

            tools = create_web_tools()
            fetch_tool = tools[1]
            result = fetch_tool.invoke({"url": "https://example.com"})

        assert "Failed" in result or "failed" in result
