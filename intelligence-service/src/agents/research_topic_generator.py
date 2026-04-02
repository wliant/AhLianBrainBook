import json

from langchain_core.messages import SystemMessage, HumanMessage
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
        f"- {n['title']}: {n['content_preview']}" for n in context.get("neurons", [])
    ) if context.get("neurons") else "No existing knowledge notes."

    prompt = (
        "You are an AI learning advisor. Generate a structured learning map for the given topic.\n\n"
        "Break the topic into 4-8 key concepts. Each concept can have 0-4 sub-points.\n"
        "For each bullet, assess completeness based on the user's existing knowledge:\n"
        '- "none": not covered at all\n'
        '- "partial": mentioned or touched on\n'
        '- "good": explained with reasonable depth\n'
        '- "complete": thoroughly covered\n\n'
        "Also identify which knowledge neurons (by neuron_id) are relevant to each bullet.\n\n"
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
    llm = get_llm(format="json")
    messages = [
        SystemMessage(content=state["system_prompt"]),
        HumanMessage(content="Generate the learning map."),
    ]
    response = llm.invoke(messages)
    return {"llm_raw_output": response.content}


def validate_output(state: dict) -> dict:
    raw = state.get("llm_raw_output", "")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
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

    return {
        "title": title,
        "items": items,
        "overall_completeness": overall,
    }


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


async def invoke_research_topic_generator(
    request: GenerateTopicRequest,
) -> GenerateTopicResponse:
    context = {
        "brain_name": request.context.brain_name,
        "research_goal": request.context.research_goal,
        "neurons": [n.model_dump() for n in request.context.neurons],
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
        return GenerateTopicResponse(title=request.prompt, items=[], overall_completeness="none")
    except Exception:
        return GenerateTopicResponse(title=request.prompt, items=[], overall_completeness="none")
