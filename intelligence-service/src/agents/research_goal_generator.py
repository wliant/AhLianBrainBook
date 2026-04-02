from typing import TypedDict

from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph

from src.config import settings
from src.llm import get_llm, get_provider_name
from src.schemas.research import GenerateGoalRequest, GenerateGoalResponse


class GoalState(TypedDict):
    brain_name: str
    neurons_context: str
    research_goal: str | None


def build_prompt(state: GoalState) -> dict:
    neurons_text = state["neurons_context"]
    prompt = (
        "You are an AI learning advisor. Given a brain (subject domain) name and a summary of "
        "the user's existing knowledge notes, generate a concise research goal (1-2 sentences) "
        "that describes what the user should aim to learn in this domain.\n\n"
        "The goal should be specific enough to guide learning but broad enough to cover the domain.\n\n"
        f"Brain name: {state['brain_name']}\n\n"
    )
    if neurons_text.strip():
        prompt += f"Existing knowledge notes:\n{neurons_text}\n\n"
    else:
        prompt += "The user has no existing notes yet in this brain.\n\n"
    prompt += "Respond with ONLY the research goal text, nothing else."
    return {"system_prompt": prompt}


def invoke_llm(state: dict) -> dict:
    llm = get_llm()
    messages = [
        SystemMessage(content=state["system_prompt"]),
        HumanMessage(content="Generate the research goal."),
    ]
    response = llm.invoke(messages)
    return {"research_goal": response.content.strip().strip('"')}


def _build_graph():
    graph = StateGraph(dict)
    graph.add_node("build_prompt", build_prompt)
    graph.add_node("invoke_llm", invoke_llm)
    graph.set_entry_point("build_prompt")
    graph.add_edge("build_prompt", "invoke_llm")
    graph.set_finish_point("invoke_llm")
    return graph.compile()


_graph = _build_graph()


async def invoke_research_goal_generator(
    request: GenerateGoalRequest,
) -> GenerateGoalResponse:
    neurons_context = "\n".join(
        f"- {n.title}: {n.content_preview}" for n in request.neurons
    ) if request.neurons else ""

    initial_state = {
        "brain_name": request.brain_name,
        "neurons_context": neurons_context,
        "research_goal": None,
    }

    try:
        result = await _graph.ainvoke(initial_state)
        return GenerateGoalResponse(
            research_goal=result.get("research_goal", "")
        )
    except TimeoutError:
        return GenerateGoalResponse(
            research_goal=""
        )
    except Exception as e:
        provider = get_provider_name()
        return GenerateGoalResponse(
            research_goal=""
        )
