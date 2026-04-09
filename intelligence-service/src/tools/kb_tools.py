"""Knowledge base search tools that call back to the Spring Boot internal API."""

import logging

import httpx
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

KB_TIMEOUT = 5.0  # seconds


def create_kb_tools(brain_id: str, api_url: str, api_key: str) -> list:
    """Create KB tools with brain_id pre-bound via closures."""

    headers = {"X-Internal-Key": api_key} if api_key else {}

    @tool
    def search_notes(query: str, limit: int = 5) -> str:
        """Search the user's knowledge base by keyword. Returns matching
        note titles and content excerpts. Use this when you need to find
        specific information the user may have written about."""
        try:
            with httpx.Client(timeout=KB_TIMEOUT) as client:
                resp = client.get(
                    f"{api_url}/api/internal/search",
                    params={"q": query, "brainId": brain_id, "size": limit},
                    headers=headers,
                )
                resp.raise_for_status()
                results = resp.json()
                if not results:
                    return "No matching notes found."
                lines = []
                for r in results:
                    lines.append(f"- \"{r['title']}\" (score: {r['score']:.2f})")
                    if r.get("preview"):
                        lines.append(f"  {r['preview']}")
                return "\n".join(lines)
        except Exception as e:
            logger.warning("search_notes failed: %s", e)
            return f"Search failed: {e}. Try generating without this information."

    @tool
    def find_related_notes(topic: str, limit: int = 5) -> str:
        """Find notes semantically related to a topic using vector similarity.
        Use this when keyword search is too narrow and you need conceptually
        related content."""
        try:
            with httpx.Client(timeout=KB_TIMEOUT) as client:
                resp = client.post(
                    f"{api_url}/api/internal/similar",
                    json={"text": topic, "brainId": brain_id, "limit": limit},
                    headers=headers,
                )
                resp.raise_for_status()
                results = resp.json()
                if not results:
                    return "No related notes found."
                lines = []
                for r in results:
                    lines.append(
                        f"- \"{r['title']}\" (similarity: {r['similarity']:.2f})"
                    )
                    if r.get("preview"):
                        lines.append(f"  {r['preview'][:300]}")
                return "\n".join(lines)
        except Exception as e:
            logger.warning("find_related_notes failed: %s", e)
            return f"Similarity search failed: {e}. Try generating without this information."

    @tool
    def read_note(neuron_id: str) -> str:
        """Read the full content of a specific note. Use this after search_notes
        or find_related_notes returns a relevant note you want to read in detail."""
        try:
            with httpx.Client(timeout=KB_TIMEOUT) as client:
                resp = client.get(
                    f"{api_url}/api/internal/neurons/{neuron_id}/content",
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
                title = data.get("title", "Untitled")
                content = data.get("contentText", "")
                if not content:
                    return f"Note \"{title}\" has no text content."
                return f"# {title}\n\n{content}"
        except Exception as e:
            logger.warning("read_note failed: %s", e)
            return f"Failed to read note: {e}."

    return [search_notes, find_related_notes, read_note]
