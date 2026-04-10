import json
from unittest.mock import patch, MagicMock

from src.agents.research_topic_generator import (
    _validate_quality,
    _check_duplicates,
    _normalize_items,
    validate_output,
    self_critique,
    build_prompt,
)
from src.agents.research_goal_generator import build_prompt as goal_build_prompt
from src.agents.research_topic_scorer import build_prompt as scorer_build_prompt
from src.agents.research_bullet_expander import build_prompt as expander_build_prompt
from src.schemas.research import NeuronSummary, BrainContext


# --- _validate_quality ---


def test_validate_quality_good_items():
    items = [
        {
            "text": "Stack vs heap allocation",
            "explanation": "Understanding when memory is allocated on the stack versus the heap and performance implications.",
            "children": [],
        },
        {
            "text": "Garbage collection algorithms",
            "explanation": "How mark-and-sweep, generational, and concurrent GC strategies reclaim unused memory.",
            "children": [],
        },
    ]
    warnings = _validate_quality(items)
    assert warnings == []


def test_validate_quality_short_explanation():
    items = [
        {"text": "Closures", "explanation": "Learn closures.", "children": []},
    ]
    warnings = _validate_quality(items)
    assert any("Short explanation" in w for w in warnings)


def test_validate_quality_filler_text():
    items = [
        {"text": "Introduction to Python", "explanation": "A comprehensive look at Python fundamentals and basics.", "children": []},
        {"text": "Overview", "explanation": "A comprehensive overview of the subject matter and key topics.", "children": []},
        {"text": "Advanced Topics", "explanation": "Exploring more advanced concepts and techniques in the field.", "children": []},
    ]
    warnings = _validate_quality(items)
    filler_warnings = [w for w in warnings if "Generic filler" in w]
    assert len(filler_warnings) == 3


def test_validate_quality_recursive_children():
    items = [
        {
            "text": "Memory Management",
            "explanation": "Understanding how programs allocate and deallocate memory resources.",
            "children": [
                {"text": "Basics", "explanation": "Short.", "children": []},
            ],
        },
    ]
    warnings = _validate_quality(items)
    assert any("Generic filler" in w and "Basics" in w for w in warnings)
    assert any("Short explanation" in w for w in warnings)


# --- _check_duplicates ---


def test_check_duplicates_no_overlap():
    items = [
        {"text": "Stack allocation"},
        {"text": "Garbage collection"},
        {"text": "Reference counting"},
    ]
    result = _check_duplicates(items)
    assert len(result) == 3


def test_check_duplicates_high_overlap():
    items = [
        {"text": "Error handling"},
        {"text": "Error handling"},
        {"text": "Memory management"},
    ]
    result = _check_duplicates(items)
    assert len(result) == 2
    texts = [item["text"] for item in result]
    assert "Error handling" in texts
    assert "Memory management" in texts


def test_check_duplicates_empty_text():
    items = [
        {"text": ""},
        {"text": "Real concept"},
    ]
    result = _check_duplicates(items)
    assert len(result) == 2


# --- validate_output ---


def test_validate_output_valid_json():
    raw = json.dumps({
        "title": "Memory Management",
        "overall_completeness": "none",
        "items": [
            {
                "id": "item-1",
                "text": "Stack vs heap allocation",
                "explanation": "Understanding when memory is allocated on the stack versus the heap.",
                "completeness": "none",
                "linked_neuron_ids": [],
                "children": [],
            },
            {
                "id": "item-2",
                "text": "Garbage collection",
                "explanation": "How automatic memory reclamation works in managed languages.",
                "completeness": "partial",
                "linked_neuron_ids": ["n1"],
                "children": [],
            },
            {
                "id": "item-3",
                "text": "Reference counting",
                "explanation": "Tracking object references to determine when memory can be freed.",
                "completeness": "none",
                "linked_neuron_ids": [],
                "children": [],
            },
        ],
    })
    state = {"llm_raw_output": raw, "prompt": "Memory Management"}
    result = validate_output(state)
    assert result["title"] == "Memory Management"
    assert len(result["items"]) == 3
    assert result["overall_completeness"] == "none"


def test_validate_output_invalid_json():
    state = {"llm_raw_output": "not valid json {{{", "prompt": "Test Topic"}
    result = validate_output(state)
    assert result["title"] == "Test Topic"
    assert result["items"] == []


def test_validate_output_removes_duplicates():
    raw = json.dumps({
        "title": "Test",
        "overall_completeness": "none",
        "items": [
            {"id": "item-1", "text": "Error handling", "explanation": "How to handle errors in production code effectively.", "completeness": "none", "linked_neuron_ids": [], "children": []},
            {"id": "item-2", "text": "Error handling", "explanation": "Patterns for handling errors in code systematically and reliably.", "completeness": "none", "linked_neuron_ids": [], "children": []},
            {"id": "item-3", "text": "Memory safety", "explanation": "Ensuring programs do not access invalid or freed memory regions.", "completeness": "none", "linked_neuron_ids": [], "children": []},
        ],
    })
    state = {"llm_raw_output": raw, "prompt": "Test"}
    result = validate_output(state)
    assert len(result["items"]) == 2


def test_validate_output_logs_low_quality(caplog):
    raw = json.dumps({
        "title": "Test",
        "overall_completeness": "none",
        "items": [
            {"id": "item-1", "text": "Concept A", "explanation": "", "completeness": "none", "linked_neuron_ids": [], "children": []},
            {"id": "item-2", "text": "Concept B", "explanation": "", "completeness": "none", "linked_neuron_ids": [], "children": []},
        ],
    })
    state = {"llm_raw_output": raw, "prompt": "Test"}
    import logging
    with caplog.at_level(logging.WARNING):
        result = validate_output(state)
    assert "minimum quality" in caplog.text.lower() or "below minimum quality" in caplog.text.lower()
    # Still returns the items (not ERROR)
    assert len(result["items"]) == 2


# --- self_critique ---


def test_self_critique_skips_invalid_json():
    state = {"llm_raw_output": "not json"}
    result = self_critique(state)
    assert result == {}


def test_self_critique_calls_llm():
    valid_json = json.dumps({"title": "Test", "items": []})
    state = {"llm_raw_output": valid_json}

    mock_response = MagicMock()
    mock_response.content = json.dumps({"title": "Improved Test", "items": []})

    with patch("src.agents.research_topic_generator.get_llm") as mock_get_llm:
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_get_llm.return_value = mock_llm

        result = self_critique(state)

    assert result["llm_raw_output"] == mock_response.content
    mock_get_llm.assert_called_once_with(
        temperature=0.2,
        max_tokens=4096,
        format="json",
    )


# --- build_prompt ---


def test_build_prompt_includes_quality_criteria():
    state = {
        "prompt": "Memory Management",
        "context": {
            "brain_name": "Systems Programming",
            "research_goal": "Master low-level programming",
            "neurons": [],
            "existing_topic_titles": [],
        },
    }
    result = build_prompt(state)
    prompt = result["system_prompt"]
    assert "3 and 10 key concepts" in prompt
    assert "Anti-patterns" in prompt
    assert "Generic filler" in prompt.lower() or "generic filler" in prompt.lower()
    assert "mentally" in prompt.lower()


def test_build_prompt_includes_existing_topics():
    state = {
        "prompt": "Concurrency",
        "context": {
            "brain_name": "Systems Programming",
            "research_goal": "Master concurrency",
            "neurons": [],
            "existing_topic_titles": ["Memory Management", "Process Scheduling"],
        },
    }
    result = build_prompt(state)
    prompt = result["system_prompt"]
    assert "Memory Management" in prompt
    assert "Process Scheduling" in prompt
    assert "Do NOT duplicate" in prompt


def test_build_prompt_includes_tags_in_neurons():
    state = {
        "prompt": "Testing",
        "context": {
            "brain_name": "Software Engineering",
            "research_goal": "Master testing",
            "neurons": [
                {
                    "neuron_id": "n1",
                    "title": "Unit Testing",
                    "content_preview": "Testing individual units...",
                    "tags": ["testing", "quality"],
                },
            ],
            "existing_topic_titles": [],
        },
    }
    result = build_prompt(state)
    prompt = result["system_prompt"]
    assert "[tags: testing, quality]" in prompt


# --- Goal generator build_prompt ---


def test_goal_prompt_includes_quality_criteria():
    state = {"brain_name": "Rust Programming", "brain_description": "Systems programming language"}
    result = goal_build_prompt(state)
    prompt = result["system_prompt"]
    assert "SPECIFIC" in prompt
    assert "SCOPED" in prompt
    assert "MEASURABLE" in prompt


def test_goal_prompt_includes_examples():
    state = {"brain_name": "Rust Programming", "brain_description": ""}
    result = goal_build_prompt(state)
    prompt = result["system_prompt"]
    assert "Good example" in prompt
    assert "Bad example" in prompt


# --- Scorer build_prompt ---


def test_scorer_prompt_includes_calibration():
    state = {
        "items": [{"id": "item-1", "text": "Test", "completeness": "none"}],
        "context": {
            "brain_name": "CS",
            "research_goal": "Master CS",
            "neurons": [],
        },
    }
    result = scorer_build_prompt(state)
    prompt = result["system_prompt"]
    assert "Scoring calibration" in prompt
    assert "choose the LOWER" in prompt
    assert "DIRECTLY discusses" in prompt


def test_scorer_prompt_renders_tags():
    state = {
        "items": [],
        "context": {
            "brain_name": "CS",
            "research_goal": "Master CS",
            "neurons": [
                {"neuron_id": "n1", "title": "Note", "content_preview": "...", "tags": ["algo", "sort"]},
            ],
        },
    }
    result = scorer_build_prompt(state)
    prompt = result["system_prompt"]
    assert "[tags: algo, sort]" in prompt


# --- Bullet expander build_prompt ---


def test_expander_prompt_includes_specificity_requirements():
    state = {
        "bullet": {"id": "item-1", "text": "Memory Management", "explanation": "How memory works", "children": []},
        "parent_context": "Systems Programming",
        "context": {
            "brain_name": "CS",
            "research_goal": "Master low-level",
            "neurons": [],
        },
    }
    result = expander_build_prompt(state)
    prompt = result["system_prompt"]
    assert "Concrete enough" in prompt
    assert "Distinct from siblings" in prompt
    assert "foundational to advanced" in prompt


def test_expander_prompt_includes_good_bad_examples():
    state = {
        "bullet": {"id": "item-1", "text": "Memory Management", "explanation": "How memory works", "children": []},
        "parent_context": "Systems Programming",
        "context": {
            "brain_name": "CS",
            "research_goal": "Master low-level",
            "neurons": [],
        },
    }
    result = expander_build_prompt(state)
    prompt = result["system_prompt"]
    assert "Bad sub-points" in prompt
    assert "Good sub-points" in prompt


# --- Schema backward compatibility ---


def test_neuron_summary_defaults_without_tags():
    summary = NeuronSummary(neuron_id="n1", title="Test")
    assert summary.tags == []
    assert summary.content_preview == ""


def test_brain_context_defaults_without_existing_topics():
    ctx = BrainContext(brain_name="Test Brain")
    assert ctx.existing_topic_titles == []
    assert ctx.neurons == []
    assert ctx.research_goal == ""
