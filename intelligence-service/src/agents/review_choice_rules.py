"""Deterministic quality rules for multiple-choice review questions.

Pure functions only — no LLM, no network — so the "are these choices actually hard?"
policy is unit-testable on its own. The guiding principle is **downgrade, never drop**:
an item that fails validation becomes a free-text question so the caller still gets the
question count it asked for.
"""

import difflib
import logging
import random
import re
import string

logger = logging.getLogger(__name__)

MIN_OPTIONS = 3
MAX_OPTIONS = 6

# Near-duplicate threshold: two options this similar give the answer away by elimination.
SIMILARITY_LIMIT = 0.9
# A conspicuously long or short option is a format cue rather than a knowledge test.
LENGTH_SPREAD_LIMIT = 2.5
# The classic giveaway: the correct option is the most elaborate one.
CORRECT_LENGTH_LIMIT = 1.4
# Length and containment cues only mean something for prose options. Terse ones —
# complexity classes, dates, version numbers, bare names — legitimately share tokens
# ("O(V log V)" inside "O(E + V log V)") and vary in length without giving anything away,
# so those two checks are skipped once every option is this short.
TERSE_OPTION_LIMIT = 40
# Below this many words an option is a term or formula, not a paraphrase of another.
CONTAINMENT_MIN_WORDS = 4

BANNED_PATTERNS = [
    re.compile(r"\ball\s+of\s+the\s+above\b", re.I),
    re.compile(r"\bnone\s+of\s+the\s+above\b", re.I),
    re.compile(r"\bboth\s+[ab]\s+and\s+[ab]\b", re.I),
    re.compile(r"\ball\s+of\s+these\b", re.I),
    re.compile(r"\bnone\s+of\s+these\b", re.I),
    re.compile(r"\banswers?\s+[ab]\s+and\s+[ab]\b", re.I),
]

_ARTICLES = {"a", "an", "the"}
_OPTION_IDS = list(string.ascii_lowercase)

CHOICE_TYPES = ("single_choice", "multi_choice")


def normalize(text: str) -> str:
    """Lowercase, drop punctuation and leading articles, collapse whitespace."""
    lowered = str(text or "").lower()
    cleaned = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in lowered)
    words = [w for w in cleaned.split() if w not in _ARTICLES]
    return " ".join(words)


def _reject(reason: str, question: str) -> None:
    logger.info("choice question rejected (%s): %.80s", reason, question)


def _option_problems(options: list[dict]) -> str | None:
    """Return a reason string if the option set is too easy or malformed, else None."""
    texts = [str(o.get("text", "")).strip() for o in options]
    if any(not t for t in texts):
        return "blank option text"

    for t in texts:
        for pattern in BANNED_PATTERNS:
            if pattern.search(t):
                return "banned phrase"

    lengths = [len(t) for t in texts]
    terse = max(lengths) < TERSE_OPTION_LIMIT

    normalized = [normalize(t) for t in texts]
    for i in range(len(normalized)):
        for j in range(i + 1, len(normalized)):
            a, b = normalized[i], normalized[j]
            if a == b:
                return "duplicate options"
            if a and b and (a in b or b in a) and not terse:
                shorter = min(len(a.split()), len(b.split()))
                if shorter >= CONTAINMENT_MIN_WORDS:
                    return "option contains another"
            if difflib.SequenceMatcher(None, a, b).ratio() > SIMILARITY_LIMIT:
                return "near-duplicate options"

    if not terse and min(lengths) > 0 and max(lengths) / min(lengths) > LENGTH_SPREAD_LIMIT:
        return "option lengths too uneven"

    correct_lengths = [len(t) for t, o in zip(texts, options) if o.get("correct")]
    wrong_lengths = [len(t) for t, o in zip(texts, options) if not o.get("correct")]
    if correct_lengths and wrong_lengths:
        if max(correct_lengths) > CORRECT_LENGTH_LIMIT * max(wrong_lengths):
            return "correct option is conspicuously longest"

    return None


def to_free_text(item: dict) -> dict:
    """Strip an item back to a free-text question, preserving stem and answer."""
    return {
        "question": item.get("question", ""),
        "answer": item.get("answer", ""),
        "question_type": "free_text",
        "choices": [],
        "explanation": item.get("explanation", "") or "",
        "researched": False,
    }


def validate_item(item: dict, rng: random.Random) -> dict:
    """Validate one generated item, shuffling its options. Downgrades on any failure."""
    question = str(item.get("question", "")).strip()
    answer = str(item.get("answer", "")).strip()
    if not question or not answer:
        return {}

    declared = item.get("question_type", "free_text")
    if declared not in CHOICE_TYPES:
        return to_free_text(item)

    raw_options = item.get("choices") or []
    options = [o for o in raw_options if isinstance(o, dict)]
    if not MIN_OPTIONS <= len(options) <= MAX_OPTIONS:
        _reject(f"option count {len(options)}", question)
        return to_free_text(item)

    correct_count = sum(1 for o in options if o.get("correct"))
    if correct_count == 0 or correct_count == len(options):
        _reject(f"{correct_count}/{len(options)} correct", question)
        return to_free_text(item)

    problem = _option_problems(options)
    if problem:
        _reject(problem, question)
        return to_free_text(item)

    # Trust the flags over the declared type — the flags are what grading uses.
    question_type = "single_choice" if correct_count == 1 else "multi_choice"

    # Shuffle before assigning ids so the correct answer isn't pinned to a position
    # and the ids stay in display order. This is the only place order is decided.
    shuffled = list(options)
    rng.shuffle(shuffled)

    final_options = []
    for index, option in enumerate(shuffled):
        source_url = option.get("source_url") or option.get("sourceUrl") or None
        final_options.append({
            "id": _OPTION_IDS[index],
            "text": str(option["text"]).strip(),
            "correct": bool(option.get("correct")),
            "rationale": str(option.get("rationale") or "").strip(),
            "source_url": source_url,
        })

    researched = bool(item.get("researched")) or any(o["source_url"] for o in final_options)

    answer_text = "; ".join(o["text"] for o in final_options if o["correct"])

    return {
        "question": question,
        "answer": answer_text or answer,
        "question_type": question_type,
        "choices": final_options,
        "explanation": str(item.get("explanation") or "").strip(),
        "researched": researched,
    }


def finalize_items(
    items: list,
    question_count: int,
    rng: random.Random | None = None,
    choice_only: bool = False,
) -> list[dict]:
    """Validate, shuffle and truncate a batch of generated items.

    ``choice_only`` inverts the module's downgrade-never-drop rule: the caller asked for
    multiple choice and nothing else, so an item that validation downgrades to free text
    is dropped instead. Callers over-generate to absorb that loss.
    """
    rng = rng or random.Random()
    validated = []
    for item in items:
        if not isinstance(item, dict):
            continue
        result = validate_item(item, rng)
        if not result:
            continue
        if choice_only and result["question_type"] not in CHOICE_TYPES:
            _reject("free text in choice-only mode", result["question"])
            continue
        validated.append(result)
    return validated[:question_count]
