import json
import logging

from langchain_core.messages import SystemMessage, HumanMessage

from src.utils import strip_code_fences

logger = logging.getLogger(__name__)
from langgraph.graph import StateGraph

from src.config import settings
from src.llm import get_llm, get_provider_name
from src.schemas.research import (
    ScoreTopicRequest,
    ScoreTopicResponse,
    BulletItem,
)

VALID_COMPLETENESS = {"none", "partial", "good", "complete"}


def build_prompt(state: dict) -> dict:
    context = state["context"]
    neurons_text = "\n".join(
        f"- [{n['neuron_id']}] {n['title']}: {n['content_preview']}"
        for n in context.get("neurons", [])
    ) if context.get("neurons") else "No existing knowledge notes."

    items_json = json.dumps(state["items"], indent=2)

    prompt = (
        "You are an AI learning advisor. Re-evaluate the completeness of each bullet point "
        "based on the user's current knowledge notes.\n\n"
        "Completeness levels:\n"
        '- "none": not covered at all in the knowledge notes\n'
        '- "partial": mentioned or touched on, but lacking depth\n'
        '- "good": explained with reasonable depth, examples present\n'
        '- "complete": thoroughly covered with depth, examples, and connections\n\n'
        "Also discover which knowledge neurons (by neuron_id from the list below) are "
        "relevant to each bullet point. Only use neuron_ids from the provided list.\n\n"
        f"Brain: {context.get('brain_name', '')}\n"
        f"Research goal: {context.get('research_goal', '')}\n\n"
        f"Knowledge neurons:\n{neurons_text}\n\n"
        f"Current bullet tree:\n{items_json}\n\n"
        "Respond with valid JSON in this exact format:\n"
        "{\n"
        '  "overall_completeness": "none",\n'
        '  "items": [ ... same structure as input but with updated completeness and linked_neuron_ids ... ]\n'
        "}\n"
    )
    return {"system_prompt": prompt}


def invoke_llm(state: dict) -> dict:
    llm = get_llm(format="json")
    messages = [
        SystemMessage(content=state["system_prompt"]),
        HumanMessage(content="Score the completeness of each bullet."),
    ]
    logger.debug("LLM request messages=%d", len(messages))
    response = llm.invoke(messages)
    logger.debug("LLM response length=%d content=%r", len(response.content), response.content[:500])
    return {"llm_raw_output": response.content}


def validate_output(state: dict) -> dict:
    raw = state.get("llm_raw_output", "")
    logger.debug("Validation input length=%d", len(raw))
    try:
        data = json.loads(strip_code_fences(raw))
    except json.JSONDecodeError:
        logger.warning("JSON parse failed for topic scorer, raw=%r", raw[:200])
        return {
            "items": state.get("items", []),
            "overall_completeness": "none",
        }

    items = _normalize_items(data.get("items", state.get("items", [])))
    overall = data.get("overall_completeness", "none")
    if overall not in VALID_COMPLETENESS:
        overall = "none"

    return {"items": items, "overall_completeness": overall}


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
    graph.add_node("validate_output", validate_output)
    graph.set_entry_point("build_prompt")
    graph.add_edge("build_prompt", "invoke_llm")
    graph.add_edge("invoke_llm", "validate_output")
    graph.set_finish_point("validate_output")
    return graph.compile()


_graph = _build_graph()


async def invoke_research_topic_scorer(
    request: ScoreTopicRequest,
) -> ScoreTopicResponse:
    context = {
        "brain_name": request.context.brain_name,
        "research_goal": request.context.research_goal,
        "neurons": [n.model_dump() for n in request.context.neurons],
    }

    initial_state = {
        "items": [item.model_dump() for item in request.items],
        "context": context,
    }

    try:
        result = await _graph.ainvoke(initial_state)
        items = [BulletItem(**item) for item in result.get("items", [])]
        return ScoreTopicResponse(
            items=items,
            overall_completeness=result.get("overall_completeness", "none"),
        )
    except TimeoutError:
        logger.warning("Timeout scoring topic items=%d", len(request.items))
        return ScoreTopicResponse(items=request.items, overall_completeness="none")
    except Exception:
        logger.exception("Failed to score topic items=%d", len(request.items))
        return ScoreTopicResponse(items=request.items, overall_completeness="none")
