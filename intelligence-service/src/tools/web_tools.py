"""Web search and page fetch tools."""

import logging

import httpx
from langchain_core.tools import tool

from src.config import settings

logger = logging.getLogger(__name__)

WEB_SEARCH_TIMEOUT = 10.0
PAGE_FETCH_TIMEOUT = 15.0


def create_web_tools(max_searches: int = 5, max_fetches: int = 3) -> list:
    """Create web search and page fetch tools with per-request rate limits."""
    search_count = [0]
    fetch_count = [0]

    @tool
    def web_search(query: str) -> str:
        """Search the web for current information. Use this for:
        - Latest API documentation or version-specific syntax
        - Current best practices that may have changed recently
        - Facts, statistics, or references that need to be accurate
        Returns top 5 search results with titles, URLs, and snippets."""
        if search_count[0] >= max_searches:
            return "Rate limit reached for web search."
        search_count[0] += 1
        if settings.tavily_api_key:
            return _search_tavily(query)
        return _search_duckduckgo(query)

    @tool
    def fetch_webpage(url: str) -> str:
        """Fetch and extract the main text content from a webpage.
        Use this when the user provides a URL directly in their message, or after
        web_search returns a relevant URL you want to read in detail.
        Returns cleaned text content, truncated to 3000 characters."""
        if fetch_count[0] >= max_fetches:
            return "Rate limit reached for page fetching."
        fetch_count[0] += 1
        try:
            with httpx.Client(timeout=PAGE_FETCH_TIMEOUT) as client:
                resp = client.get(
                    f"https://r.jina.ai/{url}",
                    headers={"Accept": "text/plain"},
                )
                resp.raise_for_status()
                text = resp.text[:3000]
                return text if text.strip() else "Page content was empty."
        except Exception as e:
            logger.warning("fetch_webpage failed for %s: %s", url, e)
            return f"Failed to fetch page: {e}."

    return [web_search, fetch_webpage]


def _search_tavily(query: str) -> str:
    try:
        with httpx.Client(timeout=WEB_SEARCH_TIMEOUT) as client:
            resp = client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "max_results": 5,
                    "include_answer": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            if not results:
                return "No web results found."
            lines = []
            for r in results:
                lines.append(f"- [{r.get('title', 'Untitled')}]({r.get('url', '')})")
                if r.get("content"):
                    lines.append(f"  {r['content'][:200]}")
            return "\n".join(lines)
    except Exception as e:
        logger.warning("Tavily search failed: %s", e)
        return _search_duckduckgo(query)


def _search_duckduckgo(query: str) -> str:
    try:
        from duckduckgo_search import DDGS

        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
            if not results:
                return "No web results found."
            lines = []
            for r in results:
                lines.append(f"- [{r.get('title', 'Untitled')}]({r.get('href', '')})")
                if r.get("body"):
                    lines.append(f"  {r['body'][:200]}")
            return "\n".join(lines)
    except ImportError:
        return "Web search is not available (duckduckgo-search not installed)."
    except Exception as e:
        logger.warning("DuckDuckGo search failed: %s", e)
        return f"Web search failed: {e}."
