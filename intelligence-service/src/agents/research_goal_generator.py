import logging

from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph

from src.config import settings
from src.llm import get_llm, get_provider_name
from src.schemas.research import GenerateGoalRequest, GenerateGoalResponse

logger = logging.getLogger(__name__)


def build_prompt(state: dict) -> dict:
    prompt = (
        "You are an AI learning advisor. Given a brain (subject domain) name and description, "
        "generate a concise research goal (1-2 sentences) that describes what the user should "
        "aim to learn in this domain.\n\n"
        "Quality criteria for the research goal:\n"
        "- SPECIFIC: Reference 2-3 concrete subtopics the user should master\n"
        "- SCOPED: Achievable within a focused study period, not \"learn everything about X\"\n"
        "- MEASURABLE: The user should be able to tell when they've reached the goal\n\n"
        "Good example (brain: \"Rust Programming\"):\n"
        "  \"Master Rust's ownership model, lifetimes, and trait system to confidently\n"
        "   write zero-cost abstractions and concurrent programs without data races.\"\n\n"
        "Bad example:\n"
        "  \"Learn about Rust programming and its features.\"\n"
        "  (Too vague — no concrete subtopics, no success criteria)\n\n"
        "Adapt the tone and depth based on context clues in the description. If the description "
        "suggests a beginner, focus on foundational concepts. If it suggests advanced study, "
        "target deeper or more specialized topics.\n\n"
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
    llm = get_llm(
        temperature=settings.temperature_goal_generator,
        max_tokens=settings.max_tokens_goal_generator,
    )
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
