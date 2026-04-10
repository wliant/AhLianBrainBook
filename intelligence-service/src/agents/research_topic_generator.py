import json
import logging

from langchain_core.messages import SystemMessage, HumanMessage

from src.utils import strip_code_fences

logger = logging.getLogger(__name__)
from langgraph.graph import StateGraph

from src.config import settings
from src.llm import get_llm, get_provider_name
from src.schemas.research import (
    GenerateTopicRequest,
    GenerateTopicResponse,
    BulletItem,
)

VALID_COMPLETENESS = {"none", "partial", "good", "complete"}


def build_prompt(state: dict) -> dict:
    context = state["context"]
    neurons_text = "\n".join(
        f"- [{n['neuron_id']}] {n['title']}"
        + (f" [tags: {', '.join(n.get('tags', []))}]" if n.get("tags") else "")
        + f": {n['content_preview']}"
        for n in context.get("neurons", [])
    ) if context.get("neurons") else "No existing knowledge notes."

    prompt = (
        "You are an AI learning advisor. Generate a structured learning map for the given topic.\n\n"
        "Generate between 3 and 10 key concepts — use fewer for narrow topics, more for broad ones. "
        "Each concept can have 0-4 sub-points.\n\n"
        "For each bullet, assess completeness based on the user's existing knowledge:\n"
        '- "none": not covered at all\n'
        '- "partial": mentioned or touched on\n'
        '- "good": explained with reasonable depth\n'
        '- "complete": thoroughly covered\n\n'
        "Also identify which knowledge neurons (by neuron_id) are relevant to each bullet.\n\n"
        "Quality criteria for each concept:\n"
        '- "text" should be a specific, well-scoped subtopic name (not "Introduction" or "Basics")\n'
        '- "explanation" should be 1-2 sentences describing WHAT to learn and WHY it matters, '
        'not just "Learn about X". Bad: "Understanding closures." Good: "How closures capture '
        'variables from their enclosing scope, enabling callback patterns and data encapsulation."\n'
        "- Children should represent genuinely distinct sub-concepts, not synonyms or rephrasing\n\n"
        "Anti-patterns to avoid:\n"
        '- Generic filler items like "Introduction", "Overview", "Advanced Topics", "Best Practices"\n'
        "- Bullet text that restates the parent topic\n"
        '- Explanations that are just the bullet text with "Learn about" prepended\n'
        '- Overlapping concepts (e.g., "Error Handling" and "Exception Management" as siblings)\n\n'
    )

    existing_titles = context.get("existing_topic_titles", [])
    if existing_titles:
        titles_str = ", ".join(f'"{t}"' for t in existing_titles)
        prompt += (
            f"The cluster already contains these topics: {titles_str}\n"
            "Do NOT duplicate concepts already covered. Focus on genuinely new ground.\n\n"
        )

    prompt += (
        "Before generating the JSON, mentally:\n"
        "1. Identify the 3 most important subtopics a practitioner must understand\n"
        "2. Check which are already covered in existing neurons or topics\n"
        "3. Order from foundational to advanced\n"
        "Then produce the structured output.\n\n"
        f"Brain: {context.get('brain_name', '')}\n"
        f"Research goal: {context.get('research_goal', '')}\n"
        f"Topic prompt: {state['prompt']}\n\n"
        f"Existing knowledge:\n{neurons_text}\n\n"
        "Respond with valid JSON in this exact format:\n"
        "{\n"
        '  "title": "Topic Title",\n'
        '  "overall_completeness": "none",\n'
        '  "items": [\n'
        "    {\n"
        '      "id": "item-1",\n'
        '      "text": "Concept Name",\n'
        '      "explanation": "What to learn about this concept.",\n'
        '      "completeness": "none",\n'
        '      "linked_neuron_ids": [],\n'
        '      "children": []\n'
        "    }\n"
        "  ]\n"
        "}\n"
    )
    return {"system_prompt": prompt}


def invoke_llm(state: dict) -> dict:
    llm = get_llm(
        temperature=settings.temperature_topic_generator,
        max_tokens=settings.max_tokens_topic_generator,
        format="json",
    )
    messages = [
        SystemMessage(content=state["system_prompt"]),
        HumanMessage(content="Generate the learning map."),
    ]
    logger.debug("LLM request messages=%d", len(messages))
    response = llm.invoke(messages)
    logger.debug("LLM response length=%d content=%r", len(response.content), response.content[:500])
    return {"llm_raw_output": response.content}


def self_critique(state: dict) -> dict:
    raw = state.get("llm_raw_output", "")
    try:
        json.loads(strip_code_fences(raw))
    except json.JSONDecodeError:
        return {}

    critique_prompt = (
        "Review this learning map for quality issues:\n"
        f"{raw}\n\n"
        "Check for:\n"
        "1. Vague or generic bullets (e.g., 'Introduction', 'Overview')\n"
        "2. Overlapping concepts that should be merged\n"
        "3. Missing obvious subtopics for this domain\n"
        "4. Explanations that are too short or just restate the bullet text\n"
        "5. Incorrect completeness assessments\n\n"
        "If issues found, output a corrected version. If the map is good, output it unchanged.\n"
        "Respond with the final JSON only."
    )

    llm = get_llm(
        temperature=0.2,
        max_tokens=settings.max_tokens_topic_generator,
        format="json",
    )
    messages = [
        SystemMessage(content=critique_prompt),
        HumanMessage(content="Review and improve this learning map."),
    ]
    logger.debug("Self-critique LLM request")
    response = llm.invoke(messages)
    logger.debug("Self-critique response length=%d", len(response.content))

    return {"llm_raw_output": response.content}


def validate_output(state: dict) -> dict:
    raw = state.get("llm_raw_output", "")
    logger.debug("Validation input length=%d", len(raw))
    try:
        data = json.loads(strip_code_fences(raw))
    except json.JSONDecodeError:
        logger.warning("JSON parse failed for topic generator, raw=%r", raw[:200])
        return {
            "title": state.get("prompt", "Untitled"),
            "items": [],
            "overall_completeness": "none",
        }

    title = data.get("title", state.get("prompt", "Untitled"))
    items = _normalize_items(data.get("items", []))
    overall = data.get("overall_completeness", "none")
    if overall not in VALID_COMPLETENESS:
        overall = "none"

    items = _check_duplicates(items)

    quality_warnings = _validate_quality(items)
    if quality_warnings:
        logger.warning("Quality issues in topic generation: %s", quality_warnings)

    non_empty_explanations = sum(1 for item in items if item.get("explanation", "").strip())
    if len(items) < 3 or non_empty_explanations == 0:
        logger.warning(
            "Topic generation below minimum quality: %d items, %d non-empty explanations",
            len(items), non_empty_explanations,
        )

    return {
        "title": title,
        "items": items,
        "overall_completeness": overall,
    }


FILLER_PATTERNS = [
    "introduction to", "overview of", "basics of", "advanced topics",
    "best practices", "getting started", "introduction", "overview", "basics",
]


def _validate_quality(items: list[dict]) -> list[str]:
    warnings = []
    for item in items:
        text = item.get("text", "")
        explanation = item.get("explanation", "")

        if len(explanation.strip()) < 20:
            warnings.append(f"Short explanation: '{text}'")

        text_lower = text.strip().lower()
        if any(text_lower == p or text_lower.startswith(p + " ") for p in FILLER_PATTERNS):
            warnings.append(f"Generic filler: '{text}'")

        warnings.extend(_validate_quality(item.get("children", [])))

    return warnings


def _check_duplicates(items: list[dict]) -> list[dict]:
    seen_word_sets: list[set[str]] = []
    deduplicated = []
    for item in items:
        words = set(item.get("text", "").lower().split())
        if not words:
            deduplicated.append(item)
            continue
        is_dup = False
        for seen in seen_word_sets:
            overlap = len(words & seen) / max(len(words | seen), 1)
            if overlap > 0.8:
                logger.warning("Dropping duplicate bullet: '%s'", item.get("text", ""))
                is_dup = True
                break
        if not is_dup:
            seen_word_sets.append(words)
            deduplicated.append(item)
    return deduplicated


def _normalize_items(items: list) -> list:
    normalized = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        completeness = item.get("completeness", "none")
        if completeness not in VALID_COMPLETENESS:
            completeness = "none"
        normalized.append({
            "id": item.get("id", f"item-{i + 1}"),
            "text": item.get("text", ""),
            "explanation": item.get("explanation", ""),
            "completeness": completeness,
            "linked_neuron_ids": item.get("linked_neuron_ids", []),
            "children": _normalize_items(item.get("children", [])),
        })
    return normalized


def _build_graph():
    graph = StateGraph(dict)
    graph.add_node("build_prompt", build_prompt)
    graph.add_node("invoke_llm", invoke_llm)
    graph.add_node("self_critique", self_critique)
    graph.add_node("validate_output", validate_output)
    graph.set_entry_point("build_prompt")
    graph.add_edge("build_prompt", "invoke_llm")
    graph.add_edge("invoke_llm", "self_critique")
    graph.add_edge("self_critique", "validate_output")
    graph.set_finish_point("validate_output")
    return graph.compile()


_graph = _build_graph()


async def invoke_research_topic_generator(
    request: GenerateTopicRequest,
) -> GenerateTopicResponse:
    context = {
        "brain_name": request.context.brain_name,
        "research_goal": request.context.research_goal,
        "neurons": [n.model_dump() for n in request.context.neurons],
        "existing_topic_titles": request.context.existing_topic_titles,
    }

    initial_state = {
        "prompt": request.prompt,
        "context": context,
    }

    try:
        result = await _graph.ainvoke(initial_state)
        items = [BulletItem(**item) for item in result.get("items", [])]
        return GenerateTopicResponse(
            title=result.get("title", request.prompt),
            items=items,
            overall_completeness=result.get("overall_completeness", "none"),
        )
    except TimeoutError:
        logger.warning("Timeout generating topic prompt=%r", request.prompt[:80])
        return GenerateTopicResponse(title=request.prompt, items=[], overall_completeness="none")
    except Exception:
        logger.exception("Failed to generate topic prompt=%r", request.prompt[:80])
        return GenerateTopicResponse(title=request.prompt, items=[], overall_completeness="none")
