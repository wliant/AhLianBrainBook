import json
import logging
from typing import TypedDict

from langchain_core.messages import SystemMessage, HumanMessage

from src.utils import strip_code_fences
from langgraph.graph import StateGraph

from src.llm import get_llm, get_provider_name
from src.schemas.review_qa import ReviewQARequest, ReviewQAResponse, ReviewQAItem

logger = logging.getLogger(__name__)


class QAState(TypedDict):
    system_prompt: str
    content_text: str
    question_count: int
    raw_response: str
    items: list[dict]
    error: str | None


def build_prompt(state: dict) -> dict:
    tags = state.get("tags", [])
    tags_str = ", ".join(tags) if tags else "none"
    prompt = (
        "You are a study quiz generator. Given a knowledge note, generate question-answer pairs "
        "that test recall and understanding of the key concepts.\n\n"
        "Guidelines:\n"
        "- Focus on important concepts, not trivial details\n"
        "- Vary question types: factual recall, conceptual understanding, application\n"
        "- Answers should be concise but complete (1-3 sentences)\n"
        "- Questions should be self-contained and understandable without seeing the note\n\n"
        f"Brain/domain: {state.get('brain_name') or 'General'}\n"
        f"Tags: {tags_str}\n"
        f"Note title: {state.get('neuron_title', 'Untitled')}\n"
        f"Number of questions to generate: {state.get('question_count', 5)}\n\n"
        "Respond with ONLY valid JSON in this exact format:\n"
        '{"questions": [{"question": "...", "answer": "..."}, ...]}\n'
    )
    return {
        "system_prompt": prompt,
        "content_text": state.get("content_text", ""),
        "question_count": state.get("question_count", 5),
        "raw_response": "",
        "items": [],
        "error": None,
    }


def invoke_llm(state: dict) -> dict:
    llm = get_llm(format="json")
    messages = [
        SystemMessage(content=state["system_prompt"]),
        HumanMessage(content=state["content_text"]),
    ]
    logger.debug("LLM request messages=%d", len(messages))
    response = llm.invoke(messages)
    logger.debug("LLM response length=%d content=%r", len(response.content), response.content[:500])
    return {
        "system_prompt": state["system_prompt"],
        "content_text": state["content_text"],
        "question_count": state["question_count"],
        "raw_response": response.content.strip(),
        "items": [],
        "error": None,
    }


def validate_output(state: dict) -> dict:
    raw = state["raw_response"]
    try:
        parsed = json.loads(strip_code_fences(raw))
        questions = parsed.get("questions", [])
        if not isinstance(questions, list):
            return {**state, "items": [], "error": "LLM response 'questions' field is not a list"}

        items = []
        for q in questions:
            if isinstance(q, dict) and "question" in q and "answer" in q:
                items.append({"question": str(q["question"]), "answer": str(q["answer"])})

        question_count = int(state.get("question_count", 5))
        items = items[:question_count]

        if not items:
            return {**state, "items": [], "error": "No valid question-answer pairs in LLM response"}

        return {**state, "items": items, "error": None}
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse LLM JSON response: %s", e)
        return {**state, "items": [], "error": f"Invalid JSON from LLM: {e}"}


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


async def invoke_review_qa_generator(
    request: ReviewQARequest,
) -> ReviewQAResponse:
    initial_state = {
        "neuron_title": request.neuron_title,
        "content_text": request.content_text,
        "question_count": request.question_count,
        "brain_name": request.brain_name,
        "tags": request.tags,
        "system_prompt": "",
        "raw_response": "",
        "items": [],
        "error": None,
    }

    try:
        result = await _graph.ainvoke(initial_state)
        items = [ReviewQAItem(**item) for item in result.get("items", [])]
        return ReviewQAResponse(items=items, error=result.get("error"))
    except TimeoutError:
        logger.error("Timeout generating review Q&A for '%s'", request.neuron_title)
        return ReviewQAResponse(error="Timeout generating questions")
    except Exception as e:
        provider = get_provider_name()
        logger.error("Error generating review Q&A with %s: %s", provider, e)
        return ReviewQAResponse(error=f"Failed to generate questions: {e}")
