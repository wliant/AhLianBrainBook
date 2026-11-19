"""Unit tests for the deterministic choice-quality rules. No LLM, no graph."""

import random

import pytest

from src.agents.review_choice_rules import finalize_items, normalize, validate_item


def _opt(text, correct=False, **kw):
    return {"text": text, "correct": correct, **kw}


def _item(options, question_type="single_choice", **kw):
    return {
        "question": "Which algorithm finds shortest paths with non-negative weights?",
        "answer": "Dijkstra",
        "question_type": question_type,
        "choices": options,
        **kw,
    }


def _good_single():
    return [
        _opt("Dijkstra's algorithm, using a priority queue", correct=True),
        _opt("Bellman-Ford, which tolerates negative edges"),
        _opt("Floyd-Warshall, computing all-pairs paths"),
        _opt("Kruskal's algorithm, building spanning trees"),
    ]


RNG = lambda: random.Random(1234)


class TestNormalize:
    def test_strips_punctuation_articles_and_case(self):
        assert normalize("The  Quick, Brown fox!") == "quick brown fox"


class TestValidItems:
    def test_single_choice_survives_and_gets_sequential_ids(self):
        result = validate_item(_item(_good_single()), RNG())
        assert result["question_type"] == "single_choice"
        assert [o["id"] for o in result["choices"]] == ["a", "b", "c", "d"]
        assert sum(1 for o in result["choices"] if o["correct"]) == 1

    def test_answer_is_derived_from_the_correct_option(self):
        result = validate_item(_item(_good_single()), RNG())
        assert result["answer"] == "Dijkstra's algorithm, using a priority queue"

    def test_multi_choice_answer_joins_all_correct_options(self):
        options = [
            _opt("Atomicity guarantees all-or-nothing commits", correct=True),
            _opt("Isolation keeps concurrent transactions apart", correct=True),
            _opt("Idempotency makes repeated calls safe"),
            _opt("Elasticity scales capacity with demand"),
            _opt("Affinity pins sessions to one server"),
        ]
        result = validate_item(_item(options, "multi_choice"), RNG())
        assert result["question_type"] == "multi_choice"
        assert "; " in result["answer"]
        assert result["answer"].count(";") == 1

    def test_type_follows_the_flags_not_the_declaration(self):
        # Declared single, but two options are flagged correct.
        options = _good_single()
        options[1]["correct"] = True
        result = validate_item(_item(options, "single_choice"), RNG())
        assert result["question_type"] == "multi_choice"

    def test_researched_is_true_when_a_distractor_has_a_source(self):
        options = _good_single()
        options[1]["source_url"] = "https://example.com/bellman-ford"
        result = validate_item(_item(options), RNG())
        assert result["researched"] is True

    def test_researched_is_false_without_sources(self):
        assert validate_item(_item(_good_single()), RNG())["researched"] is False

    def test_camel_case_source_url_is_accepted(self):
        options = _good_single()
        options[1]["sourceUrl"] = "https://example.com/x"
        result = validate_item(_item(options), RNG())
        assert any(o["source_url"] == "https://example.com/x" for o in result["choices"])


class TestDowngrades:
    """A failing choice question becomes free text, so question_count is still honoured."""

    def _assert_downgraded(self, item):
        result = validate_item(item, RNG())
        assert result["question_type"] == "free_text"
        assert result["choices"] == []
        assert result["question"] and result["answer"]

    def test_single_option_is_not_a_choice_question(self):
        self._assert_downgraded(_item([_opt("Only right", correct=True)]))

    def test_two_options_is_below_the_minimum(self):
        self._assert_downgraded(_item([_opt("A", correct=True), _opt("B")]))

    def test_no_correct_option(self):
        self._assert_downgraded(_item([_opt(o["text"]) for o in _good_single()]))

    def test_every_option_correct(self):
        self._assert_downgraded(_item([_opt(o["text"], correct=True) for o in _good_single()]))

    def test_duplicate_options(self):
        options = _good_single()
        options[2]["text"] = options[1]["text"]
        self._assert_downgraded(_item(options))

    def test_near_duplicate_options(self):
        options = _good_single()
        options[2]["text"] = options[1]["text"] + "."
        self._assert_downgraded(_item(options))

    def test_option_contained_in_another(self):
        options = _good_single()
        options[2]["text"] = "Bellman-Ford"
        self._assert_downgraded(_item(options))

    @pytest.mark.parametrize("banned", [
        "All of the above",
        "none of the above",
        "Both A and B",
        "All of these options",
    ])
    def test_banned_phrases(self, banned):
        options = _good_single()
        options[3]["text"] = banned
        self._assert_downgraded(_item(options))

    def test_blank_option_text(self):
        options = _good_single()
        options[3]["text"] = "   "
        self._assert_downgraded(_item(options))

    def test_lengths_too_uneven(self):
        options = [
            _opt("Dijkstra", correct=True),
            _opt("Bellman-Ford tolerates negative edge weights in directed graphs"),
            _opt("Floyd"),
            _opt("Kruskal"),
        ]
        self._assert_downgraded(_item(options))

    def test_correct_option_conspicuously_longest(self):
        options = [
            _opt("Dijkstra's algorithm with a binary heap priority queue structure", correct=True),
            _opt("Bellman-Ford algorithm"),
            _opt("Floyd-Warshall method"),
            _opt("Kruskal's approach ok"),
        ]
        self._assert_downgraded(_item(options))

    def test_unknown_question_type_becomes_free_text(self):
        result = validate_item(_item(_good_single(), "true_false"), RNG())
        assert result["question_type"] == "free_text"


class TestFinalizeItems:
    def test_drops_items_with_no_question_or_answer(self):
        items = [{"question": "", "answer": "x"}, {"question": "q", "answer": ""}]
        assert finalize_items(items, 5) == []

    def test_ignores_non_dict_entries(self):
        assert finalize_items(["nope", None, 42], 5) == []

    def test_truncates_to_question_count(self):
        items = [_item(_good_single()) for _ in range(6)]
        assert len(finalize_items(items, 3)) == 3

    def test_legacy_shape_passes_through_as_free_text(self):
        items = [{"question": "Why does it work?", "answer": "Because."}]
        result = finalize_items(items, 5)
        assert result[0]["question_type"] == "free_text"
        assert result[0]["choices"] == []

    def test_shuffle_preserves_the_option_set(self):
        original = {o["text"] for o in _good_single()}
        result = finalize_items([_item(_good_single())], 5, random.Random(99))
        assert {o["text"] for o in result[0]["choices"]} == original

    def test_correct_answer_is_not_pinned_to_the_first_position(self):
        # 40 independently shuffled items must not all put the key at index 0.
        items = [_item(_good_single()) for _ in range(40)]
        result = finalize_items(items, 40, random.Random(2024))
        positions = {
            next(i for i, o in enumerate(item["choices"]) if o["correct"])
            for item in result
        }
        assert len(positions) > 1
