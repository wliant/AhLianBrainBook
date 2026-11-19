"""Tests for the shared LLM-output helpers.

`extract_text` exists because Claude 5 runs adaptive thinking by default, so message
content arrives as a list of blocks instead of a string.
"""

from src.utils import extract_text, strip_code_fences


class TestStripCodeFences:
    def test_strips_json_fence(self):
        assert strip_code_fences('```json\n{"a": 1}\n```') == '{"a": 1}'

    def test_strips_bare_fence(self):
        assert strip_code_fences("```\nhello\n```") == "hello"

    def test_leaves_unfenced_text_alone(self):
        assert strip_code_fences('{"a": 1}') == '{"a": 1}'


class TestExtractText:
    def test_plain_string_passes_through(self):
        assert extract_text("  hello  ") == "hello"

    def test_skips_thinking_blocks(self):
        content = [
            {"type": "thinking", "thinking": "internal reasoning", "signature": "s"},
            {"type": "text", "text": '{"questions": []}'},
        ]
        assert extract_text(content) == '{"questions": []}'

    def test_thinking_text_never_leaks_into_output(self):
        content = [{"type": "thinking", "thinking": "SECRET"}, {"type": "text", "text": "ok"}]
        assert "SECRET" not in extract_text(content)

    def test_skips_tool_use_blocks(self):
        content = [
            {"type": "tool_use", "id": "t1", "name": "web_search", "input": {"query": "x"}},
            {"type": "text", "text": "answer"},
        ]
        assert extract_text(content) == "answer"

    def test_joins_multiple_text_blocks(self):
        content = [{"type": "text", "text": "a"}, {"type": "text", "text": "b"}]
        assert extract_text(content) == "a\nb"

    def test_accepts_blocks_without_an_explicit_type(self):
        assert extract_text([{"text": "legacy"}]) == "legacy"

    def test_accepts_bare_strings_in_a_list(self):
        assert extract_text(["a", "b"]) == "a\nb"

    def test_empty_thinking_only_content_yields_empty_string(self):
        # display="omitted" is the Claude 5 default, so thinking blocks come back empty.
        assert extract_text([{"type": "thinking", "thinking": ""}]) == ""

    def test_none_and_empty_are_safe(self):
        assert extract_text(None) == ""
        assert extract_text([]) == ""

    def test_result_is_parseable_after_fence_stripping(self):
        import json
        content = [
            {"type": "thinking", "thinking": ""},
            {"type": "text", "text": '```json\n{"questions": [{"question": "q"}]}\n```'},
        ]
        assert json.loads(strip_code_fences(extract_text(content)))["questions"][0]["question"] == "q"
