import re


def strip_code_fences(text: str) -> str:
    """Strip markdown code fences (```json ... ```) from LLM output before JSON parsing."""
    stripped = text.strip()
    match = re.match(r"^```(?:json)?\s*\n?(.*?)```\s*$", stripped, re.DOTALL)
    if match:
        return match.group(1).strip()
    return stripped


def extract_text(content) -> str:
    """Flatten an LLM message `content` field to plain text.

    Claude 5 models run adaptive thinking by default, so `content` arrives as a list of
    blocks (`thinking`, `text`, `tool_use`, ...) rather than a bare string. Only `text`
    blocks carry the answer — thinking blocks hold their text under a `thinking` key and
    are empty anyway under the default `display="omitted"`.

    Ollama still returns a plain string, so both shapes must keep working.
    """
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                # Blocks without an explicit type but with text (older shapes) still count.
                if block.get("type", "text") == "text" and "text" in block:
                    parts.append(block["text"])
        return "\n".join(parts).strip()
    return ""
