import json

from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph

from src.config import settings
from src.llm import get_llm, get_provider_name
from src.schemas.research import (
    ExpandBulletRequest,
    ExpandBulletResponse,
    BulletItem,
)

VALID_COMPLETENESS = {"none", "partial", "good", "complete"}


def build_prompt(state: dict) -> dict:
    context = state["context"]
    bullet = state["bullet"]
    neurons_text = "\n".join(
        f"- [{n['neuron_id']}] {n['title']}: {n['content_preview']}"
        for n in context.get("neurons", [])
    ) if context.get("neurons") else "No existing knowledge notes."

    existing_children = json.dumps(bullet.get("children", []), indent=2)

    prompt = (
        "You are an AI learning advisor. Break the given bullet point into 3-5 finer "
        "sub-points that the user should learn.\n\n"
        "Completeness levels:\n"
        '- "none": not covered at all\n'
        '- "partial": mentioned or touched on\n'
        '- "good": explained with reasonable depth\n'
        '- "complete": thoroughly covered\n\n'
        f"Brain: {context.get('brain_name', '')}\n"
        f"Research goal: {context.get('research_goal', '')}\n"
        f"Parent topic: {state.get('parent_context', '')}\n\n"
        f"Bullet to expand:\n"
        f"  Text: {bullet.get('text', '')}\n"
        f"  Explanation: {bullet.get('explanation', '')}\n\n"
    )
    if existing_children != "[]":
        prompt += f"Existing sub-points (keep and refine):\n{existing_children}\n\n"

    prompt += (
        f"Knowledge neurons:\n{neurons_text}\n\n"
        "Respond with valid JSON in this exact format:\n"
        "{\n"
        '  "children": [\n'
        "    {\n"
        f'      "id": "{bullet.get("id", "item")}-1",\n'
        '      "text": "Sub-concept",\n'
        '      "explanation": "What to learn.",\n'
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
        HumanMessage(content="Expand this bullet into sub-points."),
    ]
    response = llm.invoke(messages)
    return {"llm_raw_output": response.content}


def validate_output(state: dict) -> dict:
    raw = state.get("llm_raw_output", "")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"children": []}

    children = _normalize_items(data.get("children", []))
    return {"children": children}


def _normalize_items(items: list) -> list:
    normalized = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        completeness = item.get("completeness", "none")
        if completeness not in VALID_COMPLETENESS:
            completeness = "none"
        normalized.append({
            "id": item.get("id", f"sub-{i + 1}"),
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


async def invoke_research_bullet_expander(
    request: ExpandBulletRequest,
) -> ExpandBulletResponse:
    context = {
        "brain_name": request.context.brain_name,
        "research_goal": request.context.research_goal,
        "neurons": [n.model_dump() for n in request.context.neurons],
    }

    initial_state = {
        "bullet": request.bullet.model_dump(),
        "parent_context": request.parent_context,
        "context": context,
    }

    try:
        result = await _graph.ainvoke(initial_state)
        children = [BulletItem(**item) for item in result.get("children", [])]
        return ExpandBulletResponse(children=children)
    except TimeoutError:
        return ExpandBulletResponse(children=[])
    except Exception:
        return ExpandBulletResponse(children=[])
