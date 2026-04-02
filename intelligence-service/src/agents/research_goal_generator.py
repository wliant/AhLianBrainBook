import logging

from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph

from src.llm import get_llm, get_provider_name
from src.schemas.research import GenerateGoalRequest, GenerateGoalResponse

logger = logging.getLogger(__name__)


def build_prompt(state: dict) -> dict:
    prompt = (
        "You are an AI learning advisor. Given a brain (subject domain) name and description, "
        "generate a concise research goal (1-2 sentences) that describes what the user should "
        "aim to learn in this domain.\n\n"
        "The goal should be specific enough to guide learning but broad enough to cover the domain.\n\n"
        f"Brain name: {state['brain_name']}\n"
    )
    description = state.get("brain_description", "")
    if description.strip():
        prompt += f"Brain description: {description}\n\n"
    else:
        prompt += "\nNo description provided.\n\n"
    prompt += "Respond with ONLY the research goal text, nothing else."
    return {"system_prompt": prompt}


def invoke_llm(state: dict) -> dict:
    llm = get_llm()
    messages = [
        SystemMessage(content=state["system_prompt"]),
        HumanMessage(content="Generate the research goal."),
    ]
    logger.debug("LLM request messages=%d", len(messages))
    response = llm.invoke(messages)
    logger.debug("LLM response length=%d content=%r", len(response.content), response.content[:500])
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
    initial_state = {
        "brain_name": request.brain_name,
        "brain_description": request.brain_description,
    }

    try:
        result = await _graph.ainvoke(initial_state)
        return GenerateGoalResponse(
            research_goal=result.get("research_goal", "")
        )
    except TimeoutError:
        logger.warning("Timeout generating research goal for brain=%r", request.brain_name)
        return GenerateGoalResponse(research_goal="")
    except Exception:
        logger.exception("Failed to generate research goal for brain=%r", request.brain_name)
        return GenerateGoalResponse(research_goal="")
