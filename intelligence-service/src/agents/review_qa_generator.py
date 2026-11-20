import asyncio
import json
import logging
import math
from typing import TypedDict

from langchain_core.messages import SystemMessage, HumanMessage

from src.agents.review_choice_rules import finalize_items, normalize
from src.config import settings
from src.utils import extract_text, strip_code_fences
from langgraph.graph import StateGraph

from src.llm import get_llm, get_provider_name
from src.schemas.review_qa import ReviewQARequest, ReviewQAResponse, ReviewQAItem

logger = logging.getLogger(__name__)

# One shared research budget per generation, not per question: a note's questions share a
# topic, so search results are reusable and 10 questions would otherwise mean 10 budgets.
MAX_SEARCHES = 5
MAX_FETCHES = 3
RESEARCH_RECURSION_LIMIT = 12
# The DuckDuckGo fallback has no per-call timeout and rate-limits hard, so the research
# stage needs its own ceiling. Blowing it degrades to LLM-only distractors.
RESEARCH_TIMEOUT_SECONDS = 120

# A request for many questions is split into batches: one graph run cannot fit 50
# researched choice questions inside max_tokens_review_qa, and a single huge draft
# degrades in quality long before it hits the limit.
QUESTIONS_PER_BATCH = 10
# Each batch spends its own MAX_SEARCHES/MAX_FETCHES budget, so batches run a few at a
# time rather than all at once.
MAX_CONCURRENT_BATCHES = 3
# Choice-only mode drops questions that fail option validation instead of downgrading
# them, so the draft asks for more than the caller wants.
CHOICE_ONLY_OVERDRAFT = 1.4
# Validation can still reject more than the over-draft covers, so one extra round refills
# the shortfall. Bounded at one so a note that simply cannot carry the asked-for count
# costs a fixed amount rather than looping.
MAX_TOPUP_ROUNDS = 1
# Not worth a round trip for the last question or two.
MIN_TOPUP_SHORTFALL = 2


class QAState(TypedDict):
    neuron_title: str
    content_text: str
    question_count: int
    brain_name: str
    tags: list[str]
    question_mode: str
    batch_index: int
    batch_total: int
    avoid_questions: list[str]
    tools_enabled: bool
    draft: list[dict]
    research_brief: dict
    raw_response: str
    items: list[dict]
    error: str | None


# --------------------------------------------------------------------------- prompts

_CHOICE_POLICY = """
Choice question rules — these are what make the question hard rather than guessable:
- Every distractor must be a REAL, checkable fact about an ADJACENT subject: a sibling
  concept, a neighbouring version or date, a competing tool, or the right subject with
  exactly one particular altered (a number, a direction, a scope, an owner).
- Never invent nonsense, jokes, or obviously absurd options.
- Parallel form: every option uses the same grammatical shape, the same granularity, the
  same units and precision, and a similar length. The correct option must NOT be the
  longest or the most detailed.
- No option may paraphrase, contain, or be contained by another, and none may simply
  negate the correct answer.
- Never use "all of the above", "none of the above", "both A and B", or similar.
- Avoid absolutes (always, never, only) unless the correct answer needs one too.
- No stem leakage: the question must not share a distinctive phrase with exactly one option,
  and must not give a grammatical-agreement cue.
- single_choice: 4 options, exactly 1 correct.
- multi_choice: 5 options, 2 or 3 correct. Do NOT state how many are correct.
- Do not say which option is correct in the question text.
"""


def build_prompt(state: dict) -> dict:
    """Initializes the state. Kept as a node so the graph shape stays declarative."""
    return {
        "neuron_title": state.get("neuron_title", "Untitled"),
        "content_text": state.get("content_text", ""),
        "question_count": state.get("question_count", 5),
        "brain_name": state.get("brain_name", ""),
        "tags": state.get("tags", []),
        "question_mode": state.get("question_mode", "mixed"),
        "batch_index": state.get("batch_index", 0),
        "batch_total": state.get("batch_total", 1),
        "avoid_questions": state.get("avoid_questions", []),
        "tools_enabled": state.get("tools_enabled", False),
        "draft": [],
        "research_brief": {},
        "raw_response": "",
        "items": [],
        "error": None,
    }


def _note_header(state: dict) -> str:
    tags = state.get("tags") or []
    header = (
        f"Brain/domain: {state.get('brain_name') or 'General'}\n"
        f"Tags: {', '.join(tags) if tags else 'none'}\n"
        f"Note title: {state.get('neuron_title', 'Untitled')}\n"
    )
    total = state.get("batch_total", 1)
    if total > 1:
        index = state.get("batch_index", 0)
        header += (
            f"You are writing segment {index + 1} of {total} of a larger quiz on this note. "
            f"Draw your questions from the portion of the note roughly {index + 1}/{total} of the "
            "way through it, and cover material the other segments would not — the segments are "
            "merged and near-duplicate questions are discarded.\n"
        )
    avoid = state.get("avoid_questions") or []
    if avoid:
        joined = "\n".join(f"  - {q}" for q in avoid)
        header += (
            "These questions already exist and must NOT be asked again, in any wording:\n"
            f"{joined}\n"
        )
    return header


def _draft_target(state: dict) -> int:
    """How many questions the draft stage aims for — more than asked in choice-only mode."""
    count = state.get("question_count", 5)
    if state.get("question_mode") == "choice_only":
        return math.ceil(count * CHOICE_ONLY_OVERDRAFT)
    return count


def _draft_prompt(state: dict) -> str:
    count = state.get("question_count", 5)
    mode = state.get("question_mode", "mixed")
    if mode == "free_text":
        return (
            "You are a study quiz generator. Given a knowledge note, generate question-answer "
            "pairs that test recall and understanding of the key concepts.\n\n"
            "Guidelines:\n"
            "- Focus on important concepts, not trivial details\n"
            "- Vary question types: factual recall, conceptual understanding, application\n"
            "- Answers should be concise but complete (1-3 sentences)\n"
            "- Questions should be self-contained and understandable without seeing the note\n\n"
            f"{_note_header(state)}"
            f"Number of questions to generate: {count}\n\n"
            "Respond with ONLY valid JSON in this exact format:\n"
            '{"questions": [{"question": "...", "answer": "..."}, ...]}\n'
        )

    confusables = (
        "For every question also list 2-4 'confusables': the specific sibling concepts, "
        "adjacent versions, or competing tools a learner would most plausibly mix this up with. "
        "Add one focused web search query that would turn up facts about those confusables.\n\n"
    )
    if mode == "choice_only":
        # Over-draft (see _draft_target): validation drops, rather than downgrades,
        # anything that cannot carry a defensible option set.
        return (
            "You are a study quiz generator. Given a knowledge note, plan a set of MULTIPLE "
            "CHOICE questions that test recall and understanding of its key concepts.\n\n"
            "Every question must be one of:\n"
            "- single_choice: one correct option. Best for concrete, checkable facts (names, "
            "numbers, dates, API names, taxonomies) that have confusable neighbours.\n"
            "- multi_choice: several correct options. Best when a concept has a set of "
            "properties, steps, or members.\n"
            "Do NOT use free_text — a question you cannot pose as choices is discarded, not "
            "converted. Turn 'why'/'how' material into a choice question by asking which "
            "explanation, cause, or ordering is correct.\n\n"
            + confusables
            + "Guidelines:\n"
            "- Focus on important concepts, not trivial details\n"
            "- The 'answer' field holds the correct answer in plain words\n"
            "- Questions should be self-contained and understandable without seeing the note\n\n"
            f"{_note_header(state)}"
            f"Number of questions to generate: {_draft_target(state)}\n\n"
            "Respond with ONLY valid JSON in this exact format:\n"
            '{"questions": [{"question": "...", "answer": "...", '
            '"question_type": "single_choice|multi_choice", '
            '"confusables": ["..."], "research_query": "..."}, ...]}\n'
        )

    return (
        "You are a study quiz generator. Given a knowledge note, plan a set of questions that "
        "test recall and understanding of its key concepts.\n\n"
        "For each question decide the format:\n"
        "- single_choice: one correct option. Best for concrete, checkable facts (names, "
        "numbers, dates, API names, taxonomies) that have confusable neighbours.\n"
        "- multi_choice: several correct options. Best when a concept has a set of properties, "
        "steps, or members.\n"
        "- free_text: open recall. Best for 'why' and 'how' questions and explanations.\n"
        "Aim for a mix; prefer choice formats where the note gives concrete facts.\n\n"
        "For every choice question also list 2-4 'confusables': the specific sibling concepts, "
        "adjacent versions, or competing tools a learner would most plausibly mix this up with. "
        "Add one focused web search query that would turn up facts about those confusables.\n\n"
        "Guidelines:\n"
        "- Focus on important concepts, not trivial details\n"
        "- Answers should be concise but complete\n"
        "- Questions should be self-contained and understandable without seeing the note\n\n"
        f"{_note_header(state)}"
        f"Number of questions to generate: {count}\n\n"
        "Respond with ONLY valid JSON in this exact format:\n"
        '{"questions": [{"question": "...", "answer": "...", '
        '"question_type": "single_choice|multi_choice|free_text", '
        '"confusables": ["..."], "research_query": "..."}, ...]}\n'
    )


# --------------------------------------------------------------------------- nodes


def draft_questions(state: dict) -> dict:
    llm = get_llm(
        temperature=settings.temperature_review_qa,
        max_tokens=settings.max_tokens_review_qa,
        effort=settings.effort_review_qa,
        format="json",
    )
    messages = [
        SystemMessage(content=_draft_prompt(state)),
        HumanMessage(content=state["content_text"]),
    ]
    response = llm.invoke(messages)
    raw = extract_text(response.content)
    logger.debug("draft response length=%d", len(raw))

    try:
        parsed = json.loads(strip_code_fences(raw))
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse draft JSON: %s", e)
        return {**state, "draft": [], "raw_response": raw, "error": f"Invalid JSON from LLM: {e}"}

    questions = parsed.get("questions", [])
    if not isinstance(questions, list):
        return {**state, "draft": [], "error": "LLM response 'questions' field is not a list"}

    draft = [q for q in questions if isinstance(q, dict) and q.get("question") and q.get("answer")]
    if not draft:
        return {**state, "draft": [], "error": "No valid question-answer pairs in LLM response"}

    return {**state, "draft": draft[: _draft_target(state)], "raw_response": raw, "error": None}


def _get_tools() -> list:
    """Web search only — the note text is already in the prompt and there is no brain_id
    on this request to scope KB tools with."""
    from src.tools.web_tools import create_web_tools

    return create_web_tools(max_searches=MAX_SEARCHES, max_fetches=MAX_FETCHES)


def _research_request(state: dict) -> str:
    lines = []
    for index, q in enumerate(state["draft"]):
        if q.get("question_type") not in ("single_choice", "multi_choice"):
            continue
        confusables = q.get("confusables") or []
        lines.append(
            f"[{index}] question: {q['question']}\n"
            f"     keyed answer: {q['answer']}\n"
            f"     confusables: {', '.join(str(c) for c in confusables) or 'none suggested'}\n"
            f"     suggested query: {q.get('research_query') or ''}"
        )
    return "\n".join(lines)


async def research_distractors(state: dict) -> dict:
    """One batched ReAct run that mines near-miss facts and verifies the keyed answers.

    Never fails the generation: on any error the brief is empty and the next node falls
    back to LLM-only distractors.
    """
    if state.get("error") or not state.get("draft"):
        return state
    if state.get("question_mode") == "free_text":
        return state

    request_block = _research_request(state)
    if not request_block:
        logger.info("No choice questions drafted; skipping research")
        return state

    from langgraph.prebuilt import create_react_agent

    system = (
        "You are a research assistant building hard multiple-choice distractors.\n\n"
        f"You have at most {MAX_SEARCHES} web searches and {MAX_FETCHES} page fetches for the "
        "WHOLE batch below, so merge queries across questions by topic instead of searching "
        "per question. Spend effort first on the answers most likely to be wrong.\n\n"
        "For each question:\n"
        "1. Verify the keyed answer. If sources contradict it, say so and give the correction.\n"
        "2. Find specific, real, checkable facts about the listed confusables — things that are "
        "TRUE of a neighbouring subject but FALSE for this question. These become distractors.\n\n"
        "Respond with ONLY valid JSON:\n"
        '{"per_question": [{"index": 0, "verified": true, "corrected_answer": null, '
        '"neighbors": [{"text": "...", "why_wrong": "...", "source_url": "..."}], '
        '"sources": ["..."]}]}\n'
    )

    try:
        agent = create_react_agent(get_llm(), _get_tools())
        result = await asyncio.wait_for(
            agent.ainvoke(
                {"messages": [
                    SystemMessage(content=system),
                    HumanMessage(content=f"{_note_header(state)}\n{request_block}"),
                ]},
                config={"recursion_limit": RESEARCH_RECURSION_LIMIT},
            ),
            timeout=RESEARCH_TIMEOUT_SECONDS,
        )
        raw = extract_text(result["messages"][-1].content)
        brief = json.loads(strip_code_fences(raw))
        if not isinstance(brief, dict):
            raise ValueError("research brief is not an object")
        logger.info("research brief covered %d questions", len(brief.get("per_question", [])))
        return {**state, "research_brief": brief}
    except Exception as e:
        # Degraded, not failed: better an easier unverified quiz than no quiz.
        logger.warning("Distractor research failed, falling back to LLM-only: %s", e)
        return {**state, "research_brief": {}}


def _keep_policy(state: dict) -> str:
    if state.get("question_mode") == "choice_only":
        return (
            "Every question must come back as single_choice or multi_choice. If you cannot "
            "build a defensible option set for one, OMIT it entirely — do not emit free_text."
        )
    return (
        "Keep free_text questions as they are (empty choices). Keep every drafted question — "
        "if you cannot build good options for one, emit it as free_text instead."
    )


def _assemble_prompt(state: dict, has_brief: bool) -> str:
    source = (
        "Use the research brief below as your source of distractors. Attach the source_url of "
        "the fact each distractor came from, and set \"researched\": true for questions the "
        "brief covered. If the brief says a keyed answer was contradicted, use its correction."
        if has_brief else
        "No research was available, so build distractors from the note and your own knowledge "
        "of adjacent concepts. Leave source_url null and \"researched\": false."
    )
    return (
        "You are finalizing a study quiz. Turn the drafted questions into their final form.\n\n"
        f"{source}\n"
        f"{_CHOICE_POLICY}\n"
        f"{_keep_policy(state)}\n\n"
        "Respond with ONLY valid JSON in this exact format:\n"
        '{"questions": [{"question": "...", "answer": "...", '
        '"question_type": "single_choice|multi_choice|free_text", '
        '"choices": [{"text": "...", "correct": true, "rationale": "...", "source_url": "..."}], '
        '"explanation": "...", "researched": false}, ...]}\n'
    )


def assemble_choices(state: dict) -> dict:
    if state.get("error") or not state.get("draft"):
        return state

    # Free-text-only mode: the draft is already the final shape.
    if state.get("question_mode") == "free_text":
        return {**state, "items": [
            {"question": q["question"], "answer": q["answer"], "question_type": "free_text"}
            for q in state["draft"]
        ]}

    brief = state.get("research_brief") or {}
    has_brief = bool(brief.get("per_question"))

    payload = {
        "questions": state["draft"],
        "research_brief": brief,
    }
    llm = get_llm(
        temperature=settings.temperature_review_qa_choices,
        max_tokens=settings.max_tokens_review_qa,
        effort=settings.effort_review_qa_choices,
        format="json",
    )
    response = llm.invoke([
        SystemMessage(content=_assemble_prompt(state, has_brief)),
        HumanMessage(content=json.dumps(payload)),
    ])
    raw = extract_text(response.content)

    try:
        parsed = json.loads(strip_code_fences(raw))
        questions = parsed.get("questions", [])
        if not isinstance(questions, list) or not questions:
            raise ValueError("no questions in assemble output")
        return {**state, "items": questions, "raw_response": raw, "error": None}
    except Exception as e:
        if state.get("question_mode") == "choice_only":
            # Free text is not an acceptable substitute here, so this batch yields nothing.
            logger.warning("Failed to assemble choices in choice-only mode: %s", e)
            return {**state, "items": []}
        # Fall back to the draft as plain free-text questions rather than losing the quiz.
        logger.warning("Failed to assemble choices, falling back to free text: %s", e)
        return {**state, "items": [
            {"question": q["question"], "answer": q["answer"], "question_type": "free_text"}
            for q in state["draft"]
        ]}


def validate_output(state: dict) -> dict:
    if state.get("error"):
        return state

    items = finalize_items(
        state.get("items") or [],
        state["question_count"],
        choice_only=state.get("question_mode") == "choice_only",
    )
    if not items:
        return {**state, "items": [], "error": "No valid question-answer pairs in LLM response"}

    choice_count = sum(1 for i in items if i["question_type"] != "free_text")
    logger.info("validated %d questions (%d choice)", len(items), choice_count)
    return {**state, "items": items, "error": None}


# --------------------------------------------------------------------------- graphs


def _build_linear_graph():
    graph = StateGraph(dict)
    graph.add_node("build_prompt", build_prompt)
    graph.add_node("draft_questions", draft_questions)
    graph.add_node("assemble_choices", assemble_choices)
    graph.add_node("validate_output", validate_output)
    graph.set_entry_point("build_prompt")
    graph.add_edge("build_prompt", "draft_questions")
    graph.add_edge("draft_questions", "assemble_choices")
    graph.add_edge("assemble_choices", "validate_output")
    graph.set_finish_point("validate_output")
    return graph.compile()


def _build_tool_graph():
    graph = StateGraph(dict)
    graph.add_node("build_prompt", build_prompt)
    graph.add_node("draft_questions", draft_questions)
    graph.add_node("research_distractors", research_distractors)
    graph.add_node("assemble_choices", assemble_choices)
    graph.add_node("validate_output", validate_output)
    graph.set_entry_point("build_prompt")
    graph.add_edge("build_prompt", "draft_questions")
    graph.add_edge("draft_questions", "research_distractors")
    graph.add_edge("research_distractors", "assemble_choices")
    graph.add_edge("assemble_choices", "validate_output")
    graph.set_finish_point("validate_output")
    return graph.compile()


# Compiled lazily so tests can reset these and rebuild against a patched get_llm.
_linear_graph = None
_tool_graph = None


def _get_graph(tools_enabled: bool = False):
    global _linear_graph, _tool_graph
    if tools_enabled:
        if _tool_graph is None:
            _tool_graph = _build_tool_graph()
        return _tool_graph
    if _linear_graph is None:
        _linear_graph = _build_linear_graph()
    return _linear_graph


def _split_batches(question_count: int) -> list[int]:
    """Split a requested count into per-run sizes, spread evenly so no batch is a runt."""
    if question_count <= QUESTIONS_PER_BATCH:
        return [max(question_count, 1)]
    batches = math.ceil(question_count / QUESTIONS_PER_BATCH)
    base, remainder = divmod(question_count, batches)
    return [base + (1 if i < remainder else 0) for i in range(batches)]


def _merge_batches(results: list[list[dict]], question_count: int) -> list[dict]:
    """Concatenate batch outputs, dropping questions that repeat one already taken."""
    merged: list[dict] = []
    seen: set[str] = set()
    for items in results:
        for item in items:
            key = normalize(item.get("question", ""))
            if not key or key in seen:
                continue
            seen.add(key)
            merged.append(item)
    return merged[:question_count]


async def invoke_review_qa_generator(
    request: ReviewQARequest,
) -> ReviewQAResponse:
    # Research only helps if choice questions are wanted at all.
    use_tools = request.tools_enabled and request.question_mode != "free_text"
    graph = _get_graph(use_tools)

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_BATCHES)
    errors: list[str] = []
    collected: list[list[dict]] = []
    merged: list[dict] = []

    def initial_state(index: int, size: int, total: int, avoid: list[str]) -> dict:
        return {
            "neuron_title": request.neuron_title,
            "content_text": request.content_text,
            "question_count": size,
            "brain_name": request.brain_name,
            "tags": request.tags,
            "question_mode": request.question_mode,
            "batch_index": index,
            "batch_total": total,
            "avoid_questions": avoid,
            "tools_enabled": use_tools,
            "draft": [],
            "research_brief": {},
            "raw_response": "",
            "items": [],
            "error": None,
        }

    async def run_round(sizes: list[int], avoid: list[str]) -> list:
        async def run_batch(index: int, size: int) -> dict:
            async with semaphore:
                return await graph.ainvoke(initial_state(index, size, len(sizes), avoid))

        return await asyncio.gather(
            *(run_batch(i, size) for i, size in enumerate(sizes)),
            return_exceptions=True,
        )

    def absorb(results: list) -> None:
        """Collect one round's output. A failed batch is logged, not fatal."""
        for index, result in enumerate(results):
            if isinstance(result, BaseException):
                logger.warning("Review Q&A batch %d failed: %s", index, result)
                errors.append(str(result))
                continue
            if result.get("error"):
                logger.warning("Review Q&A batch %d returned error: %s", index, result["error"])
                errors.append(result["error"])
            collected.append(result.get("items") or [])

    try:
        sizes = _split_batches(request.question_count)
        absorb(await asyncio.wait_for(run_round(sizes, []), timeout=settings.agent_timeout))
        merged = _merge_batches(collected, request.question_count)

        # Validation rejects rather than downgrades in choice-only mode, and duplicates are
        # dropped when batches merge, so a round can come back short of what was asked.
        for _ in range(MAX_TOPUP_ROUNDS):
            shortfall = request.question_count - len(merged)
            if shortfall < MIN_TOPUP_SHORTFALL:
                break
            logger.info("topping up %d missing questions", shortfall)
            absorb(await asyncio.wait_for(
                run_round(_split_batches(shortfall), [i["question"] for i in merged]),
                timeout=settings.agent_timeout,
            ))
            merged = _merge_batches(collected, request.question_count)
    except TimeoutError:
        logger.error("Timeout generating review Q&A for '%s'", request.neuron_title)
        if not merged:
            return ReviewQAResponse(error="Timeout generating questions")
    except Exception as e:
        provider = get_provider_name()
        logger.error("Error generating review Q&A with %s: %s", provider, e)
        if not merged:
            return ReviewQAResponse(error=f"Failed to generate questions: {e}")

    if not merged:
        return ReviewQAResponse(error=errors[0] if errors else "No questions generated")

    if len(merged) < request.question_count:
        # Visible rather than silent: the caller asked for more than the note could carry.
        logger.info(
            "returning %d of %d requested questions", len(merged), request.question_count)

    try:
        items = [ReviewQAItem(**item) for item in merged]
    except Exception as e:
        logger.error("Invalid review Q&A item: %s", e)
        return ReviewQAResponse(error=f"Failed to generate questions: {e}")
    return ReviewQAResponse(items=items, error=None)
