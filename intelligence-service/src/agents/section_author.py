import asyncio
import json
import logging
from typing import TypedDict
from uuid import uuid4

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from src.config import settings
from src.utils import strip_code_fences

logger = logging.getLogger(__name__)
from src.llm import get_llm, get_provider_name
from src.schemas.section_author import (
    QuestionItem,
    SectionAuthorRequest,
    SectionAuthorResponse,
)

SECTION_SCHEMAS = {
    "code": {
        "description": "A code block with language specification",
        "schema": {"code": "string", "language": "string"},
        "example": {"code": "print('hello')", "language": "python"},
    },
    "math": {
        "description": "A LaTeX math expression",
        "schema": {"latex": "string", "displayMode": "boolean"},
        "example": {"latex": "E = mc^2", "displayMode": True},
    },
    "diagram": {
        "description": "A Mermaid diagram",
        "schema": {"source": "string", "diagramType": "mermaid"},
        "example": {"source": "graph TD\n  A-->B", "diagramType": "mermaid"},
    },
    "callout": {
        "description": "A styled callout box",
        "schema": {"variant": "info|warning|tip|note", "text": "string"},
        "example": {"variant": "info", "text": "Remember to save your work."},
    },
    "table": {
        "description": "A data table",
        "schema": {"headers": "string[]", "rows": "string[][]"},
        "example": {"headers": ["Name", "Value"], "rows": [["A", "1"]]},
    },
    "rich-text": {
        "description": "TipTap JSON document",
        "schema": {"type": "doc", "content": "TipTap node array"},
        "example": {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "Hello"}],
                }
            ],
        },
    },
}


class SectionAuthorState(TypedDict):
    # Input
    section_type: str
    current_content: dict | None
    user_message: str
    conversation_history: list[dict]
    question_answers: list[dict] | None
    context: dict
    regenerate: bool
    # Intermediate
    system_prompt: str | None
    llm_raw_output: str | None
    # Output
    response_type: str | None
    questions: list[dict] | None
    section_content: dict | None
    message: str | None
    message_severity: str | None
    explanation: str | None


def build_system_prompt(state: SectionAuthorState) -> dict:
    section_type = state["section_type"]
    schema_info = SECTION_SCHEMAS.get(section_type, SECTION_SCHEMAS["rich-text"])
    ctx = state["context"]

    sibling_text = ""
    for s in ctx.get("sibling_sections_summary", []):
        if s["section_id"] != ctx.get("section_id"):
            sibling_text += f"  - [{s['section_type']}] {s['preview']}\n"

    prompt = f"""You are a section authoring assistant for a note-taking app called BrainBook.
You are helping the user write content for a "{section_type}" section.

## Neuron Context
- Title: {ctx.get('neuron_title', 'Untitled')}
- Brain: {ctx.get('brain_name', 'Unknown')}
- Cluster: {ctx.get('cluster_name') or 'None'}
- Tags: {', '.join(ctx.get('tags', [])) or 'None'}
- Other sections in this neuron:
{sibling_text or '  (none)'}

## Section Type: {section_type}
{schema_info['description']}
Output schema: {json.dumps(schema_info['schema'])}
Example: {json.dumps(schema_info['example'])}

## Current Section Content
{json.dumps(state['current_content']) if state['current_content'] else 'Empty (new section)'}

## Instructions
You MUST respond with valid JSON in exactly one of these formats:

1. If you need clarification before generating:
{{"action": "questions", "questions": [{{"id": "q1", "text": "Your question", "input_type": "single-select", "options": ["Option A", "Option B"]}}, {{"id": "q2", "text": "Details?", "input_type": "free-text"}}], "explanation": "Why you need this info"}}

2. If you can generate content:
{{"action": "content", "section_content": <content matching the section schema above>, "explanation": "What you generated"}}

3. If you want to reply conversationally (discuss, explain, or acknowledge before generating):
{{"action": "reply", "text": "Your conversational response here"}}

input_type must be one of: "single-select", "multi-select", "free-text".
For single-select and multi-select, provide "options" array.

Do NOT wrap the JSON in markdown code fences. Return raw JSON only."""

    return {"system_prompt": prompt}


def classify_intent(state: SectionAuthorState) -> dict:
    # Intent is informational — all paths go through invoke_llm
    has_answers = bool(state.get("question_answers"))
    is_regenerate = state.get("regenerate", False)

    has_prior_content = any(
        turn.get("content", {}).get("type") == "section_content"
        for turn in state.get("conversation_history", [])
        if turn.get("role") == "assistant"
    )
    has_message = bool(state.get("user_message", "").strip())

    if is_regenerate or has_answers:
        return {}  # generate mode — no state changes needed
    if has_prior_content and has_message:
        return {}  # refine mode
    return {}  # first turn — LLM decides


def invoke_llm(state: SectionAuthorState) -> dict:
    llm = get_llm(format="json")

    messages = [SystemMessage(content=state["system_prompt"])]

    # Replay conversation history
    for turn in state.get("conversation_history", []):
        content = turn.get("content", {})
        if turn["role"] == "user":
            if content.get("type") == "text":
                messages.append(HumanMessage(content=content["text"]))
            elif content.get("type") == "answers":
                formatted = "\n".join(
                    f"- {a['questionId']}: {a['value']}"
                    for a in content.get("answers", [])
                )
                messages.append(
                    HumanMessage(content=f"My answers:\n{formatted}")
                )
        elif turn["role"] == "assistant":
            if content.get("type") == "questions":
                messages.append(
                    AIMessage(
                        content=json.dumps(
                            {
                                "action": "questions",
                                "questions": content["questions"],
                            }
                        )
                    )
                )
            elif content.get("type") == "section_content":
                messages.append(
                    AIMessage(
                        content=json.dumps(
                            {
                                "action": "content",
                                "section_content": content["sectionContent"],
                            }
                        )
                    )
                )

    # Add current turn
    if state.get("question_answers"):
        formatted = "\n".join(
            f"- {a['question_id']}: {a['value']}"
            for a in state["question_answers"]
        )
        messages.append(
            HumanMessage(
                content=f"Here are my answers:\n{formatted}\n\nPlease generate the content now."
            )
        )
    elif state.get("regenerate"):
        messages.append(
            HumanMessage(
                content="Please regenerate the content with a different approach."
            )
        )
    elif state.get("user_message", "").strip():
        messages.append(HumanMessage(content=state["user_message"]))

    logger.debug("LLM request messages=%d", len(messages))
    response = llm.invoke(messages)
    logger.debug("LLM response length=%d content=%r", len(response.content), response.content[:500])
    return {"llm_raw_output": response.content}


def validate_output(state: SectionAuthorState) -> dict:
    raw = state.get("llm_raw_output", "")
    logger.debug("Validation input length=%d", len(raw))

    try:
        parsed = json.loads(strip_code_fences(raw))
    except (json.JSONDecodeError, TypeError):
        logger.warning("JSON parse failed for section author, raw=%r", raw[:200])
        return {
            "response_type": "message",
            "message": "The AI produced an invalid response. Please try again.",
            "message_severity": "error",
            "explanation": None,
            "questions": None,
            "section_content": None,
        }

    action = parsed.get("action")

    if action == "questions":
        questions = []
        for q in parsed.get("questions", []):
            questions.append(
                {
                    "id": q.get("id", str(uuid4())),
                    "text": q.get("text", ""),
                    "input_type": q.get("input_type", "free-text"),
                    "options": q.get("options"),
                    "required": q.get("required", True),
                }
            )
        return {
            "response_type": "questions",
            "questions": questions,
            "explanation": parsed.get("explanation"),
            "section_content": None,
            "message": None,
            "message_severity": None,
        }

    if action == "content":
        section_content = parsed.get("section_content", {})
        section_type = state["section_type"]

        # Fill defaults for missing fields
        if section_type == "code":
            section_content.setdefault("code", "")
            section_content.setdefault("language", "javascript")
        elif section_type == "math":
            section_content.setdefault("latex", "")
            section_content.setdefault("displayMode", True)
        elif section_type == "diagram":
            section_content.setdefault("source", "")
            section_content.setdefault("diagramType", "mermaid")
        elif section_type == "callout":
            section_content.setdefault("variant", "info")
            section_content.setdefault("text", "")
        elif section_type == "table":
            section_content.setdefault("headers", [])
            section_content.setdefault("rows", [])
        elif section_type == "rich-text":
            if section_content.get("type") != "doc":
                section_content = {
                    "type": "doc",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": str(section_content)}
                            ],
                        }
                    ],
                }

        return {
            "response_type": "content",
            "section_content": section_content,
            "explanation": parsed.get("explanation"),
            "questions": None,
            "message": None,
            "message_severity": None,
        }

    if action == "reply":
        return {
            "response_type": "reply",
            "message": parsed.get("text", ""),
            "message_severity": None,
            "explanation": None,
            "questions": None,
            "section_content": None,
        }

    return {
        "response_type": "message",
        "message": "Unexpected response from AI. Please try again.",
        "message_severity": "error",
        "explanation": None,
        "questions": None,
        "section_content": None,
    }


def _build_graph():
    graph = StateGraph(SectionAuthorState)
    graph.add_node("build_system_prompt", build_system_prompt)
    graph.add_node("classify_intent", classify_intent)
    graph.add_node("invoke_llm", invoke_llm)
    graph.add_node("validate_output", validate_output)
    graph.add_edge(START, "build_system_prompt")
    graph.add_edge("build_system_prompt", "classify_intent")
    graph.add_edge("classify_intent", "invoke_llm")
    graph.add_edge("invoke_llm", "validate_output")
    graph.add_edge("validate_output", END)
    return graph.compile()


_compiled_graph = None


def _get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = _build_graph()
    return _compiled_graph


async def invoke_section_author(request: SectionAuthorRequest) -> SectionAuthorResponse:
    graph = _get_graph()

    initial_state: SectionAuthorState = {
        "section_type": request.section_type,
        "current_content": request.current_content,
        "user_message": request.user_message,
        "conversation_history": [t.model_dump() for t in request.conversation_history],
        "question_answers": (
            [a.model_dump() for a in request.question_answers]
            if request.question_answers
            else None
        ),
        "context": request.context.model_dump(),
        "regenerate": request.regenerate,
        "system_prompt": None,
        "llm_raw_output": None,
        "response_type": None,
        "questions": None,
        "section_content": None,
        "message": None,
        "message_severity": None,
        "explanation": None,
    }

    try:
        result = await asyncio.wait_for(
            graph.ainvoke(initial_state),
            timeout=settings.agent_timeout,
        )
    except TimeoutError:
        logger.warning("Timeout in section author for section_type=%s", request.section_type)
        return SectionAuthorResponse(
            response_type="message",
            message="The request timed out. Please try again.",
            message_severity="error",
        )
    except Exception as e:
        err_str = str(e).lower()
        if "connection" in err_str or "refused" in err_str or "connect" in err_str:
            logger.error("Cannot connect to LLM provider: %s", e)
            return SectionAuthorResponse(
                response_type="message",
                message=f"Cannot connect to the AI model server ({get_provider_name()}). Please ensure it is running.",
                message_severity="error",
            )
        raise

    return SectionAuthorResponse(
        response_type=result["response_type"],
        questions=(
            [QuestionItem(**q) for q in result["questions"]]
            if result.get("questions")
            else None
        ),
        section_content=result.get("section_content"),
        message=result.get("message"),
        message_severity=result.get("message_severity"),
        explanation=result.get("explanation"),
    )
