"""Context tools bound to the current request's section and cluster."""

import json

from langchain_core.tools import tool


def create_context_tools(current_content: dict | None, context: dict) -> list:
    """Create context-inspection tools with request data pre-bound via closures."""

    @tool
    def get_current_section() -> str:
        """Get the current content of the section being edited.
        Call this before making any modifications to understand what already exists."""
        if not current_content:
            return "Section is empty (no existing content)."
        return json.dumps(current_content, indent=2)

    @tool
    def list_cluster_notes() -> str:
        """Returns notes the system already identified as related to this neuron.
        Use search_notes or find_related_notes to actively search by keyword or topic."""
        items = context.get("knowledge_context", [])
        if not items:
            return "No notes found in this cluster."
        lines = []
        for item in items:
            tags = f" [{', '.join(item['tags'])}]" if item.get("tags") else ""
            lines.append(f"- [{item['neuron_id']}] \"{item['title']}\"{tags} ({item['relationship']})")
            if item.get("content_preview"):
                lines.append(f"  {item['content_preview'][:200]}")
        return "\n".join(lines)

    return [get_current_section, list_cluster_notes]
