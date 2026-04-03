import re


def strip_code_fences(text: str) -> str:
    """Strip markdown code fences (```json ... ```) from LLM output before JSON parsing."""
    stripped = text.strip()
    match = re.match(r"^```(?:json)?\s*\n?(.*?)```\s*$", stripped, re.DOTALL)
    if match:
        return match.group(1).strip()
    return stripped
