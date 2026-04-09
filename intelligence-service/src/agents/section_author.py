import asyncio
import json
import logging
from typing import Any, TypedDict
from uuid import uuid4

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
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
    tools_enabled: bool
    # Intermediate
    system_prompt: str | None
    intent_instructions: str | None
    llm_raw_output: str | None
    llm_response: Any | None
    tool_results: list[Any]
    tool_iteration: int
    web_search_count: int
    page_fetch_count: int
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

    knowledge_text = ""
    for item in ctx.get("knowledge_context", []):
        tags_str = ", ".join(item.get("tags", [])) if item.get("tags") else ""
        tag_display = f" ({tags_str})" if tags_str else ""
        knowledge_text += f'  - [{item["relationship"]}] "{item["title"]}"{tag_display}\n'
        preview = item.get("content_preview", "")
        if preview:
            knowledge_text += f"    {preview}\n"

    knowledge_section = ""
    if knowledge_text:
        knowledge_section = f"""
## Related Knowledge from User's Notes
The user has the following related notes in their knowledge base.
Use these to make your output consistent with their existing content,
reference their terminology, and build on what they already know.
Do NOT simply repeat their existing notes — add value beyond what's already written.

{knowledge_text}"""

    prompt = f"""You are a section authoring assistant for a note-taking app called BrainBook.
You are helping the user write content for a "{section_type}" section.

## Neuron Context
- Title: {ctx.get('neuron_title', 'Untitled')}
- Brain: {ctx.get('brain_name', 'Unknown')}
- Cluster: {ctx.get('cluster_name') or 'None'}
- Tags: {', '.join(ctx.get('tags', [])) or 'None'}
- Other sections in this neuron:
{sibling_text or '  (none)'}
{knowledge_section}
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

    if state.get("tools_enabled"):
        prompt += """

## Available Tools
You have access to tools that can search the user's knowledge base and the web.
Use tools when the user's request would benefit from additional context, research,
or verification. After using tools, synthesize the results into your final response.
When you are ready to provide your final answer, respond with the JSON format above.
Do NOT call tools and provide the final JSON in the same response."""

    return {"system_prompt": prompt}


def classify_intent(state: SectionAuthorState) -> dict:
    has_answers = bool(state.get("question_answers"))
    is_regenerate = state.get("regenerate", False)
    section_type = state["section_type"]
    has_knowledge = bool(state["context"].get("knowledge_context"))

    has_prior_content = any(
        turn.get("content", {}).get("type") == "section_content"
        for turn in state.get("conversation_history", [])
        if turn.get("role") == "assistant"
    )
    has_message = bool(state.get("user_message", "").strip())

    parts = []

    # Section-type-aware context guidance
    if has_knowledge:
        type_hints = {
            "code": (
                "Pay special attention to code patterns, import conventions, "
                "and variable naming from the user's related notes. Match their coding style."
            ),
            "math": (
                "Use the same mathematical notation as the user's related notes "
                "(e.g., variable names, symbols, formatting conventions)."
            ),
            "diagram": (
                "Consider the relationships between concepts in the user's "
                "cluster when structuring the diagram."
            ),
            "table": (
                "Match column naming conventions and data formatting "
                "from the user's related tables."
            ),
        }
        hint = type_hints.get(section_type)
        if hint:
            parts.append(hint)

    # Intent-specific instructions
    if has_answers:
        parts.append(
            "The user has answered your questions. "
            "Generate content now based on their answers. Do not ask more questions."
        )
    elif is_regenerate and has_prior_content:
        previous_output = None
        for turn in reversed(state.get("conversation_history", [])):
            if (
                turn.get("role") == "assistant"
                and turn.get("content", {}).get("type") == "section_content"
            ):
                previous_output = json.dumps(
                    turn["content"].get("sectionContent", {}), ensure_ascii=False
                )
                break
        if previous_output:
            parts.append(
                f"Here is what you previously generated:\n{previous_output}\n\n"
                "Generate a substantially different version. Use a different structure, "
                "approach, or style. Do not simply rephrase — make meaningful changes."
            )
        else:
            parts.append("Generate content with a fresh, different approach.")
    elif is_regenerate:
        parts.append("Generate content with a fresh, different approach.")
    elif has_prior_content and has_message:
        parts.append(
            "The user already has generated content. "
            "Make targeted modifications based on their message "
            "rather than rewriting from scratch."
        )

    if parts:
        return {"intent_instructions": "\n\n".join(parts)}
    return {"intent_instructions": None}


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

    # Add current turn (with intent instructions from classify_intent)
    intent = state.get("intent_instructions") or ""

    if state.get("question_answers"):
        formatted = "\n".join(
            f"- {a['question_id']}: {a['value']}"
            for a in state["question_answers"]
        )
        msg = f"Here are my answers:\n{formatted}\n\nPlease generate the content now."
        if intent:
            msg = f"{intent}\n\n{msg}"
        messages.append(HumanMessage(content=msg))
    elif state.get("regenerate"):
        msg = intent if intent else "Please regenerate the content with a different approach."
        messages.append(HumanMessage(content=msg))
    elif state.get("user_message", "").strip():
        msg = state["user_message"]
        if intent:
            msg = f"{intent}\n\nUser request: {msg}"
        messages.append(HumanMessage(content=msg))

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


MAX_TOOL_ITERATIONS = 3
MAX_TOOL_CALLS_PER_ITERATION = 2
MAX_WEB_SEARCHES = 10
MAX_PAGE_FETCHES = 5


def _get_tools(state: SectionAuthorState) -> list:
    """Create tools scoped to this request's brain_id."""
    from src.tools.kb_tools import create_kb_tools
    from src.tools.web_tools import create_web_tools

    ctx = state["context"]
    brain_id = ctx.get("brain_id", "")
    kb = create_kb_tools(brain_id, settings.brainbook_api_url, settings.internal_api_key)
    web = create_web_tools()
    return kb + web


def _build_tool_messages(state: SectionAuthorState, messages: list) -> list:
    """Append tool call/result messages from previous iterations."""
    for msg in state.get("tool_results", []):
        messages.append(msg)
    return messages


def invoke_llm_with_tools(state: SectionAuthorState) -> dict:
    """LLM node for tool-enabled path. No JSON mode — uses bind_tools."""
    llm = get_llm()  # No format="json" — incompatible with tool use
    tools = _get_tools(state)
    llm_with_tools = llm.bind_tools(tools)

    messages = [SystemMessage(content=state["system_prompt"])]

    # Replay conversation history (same as invoke_llm)
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
                messages.append(HumanMessage(content=f"My answers:\n{formatted}"))
        elif turn["role"] == "assistant":
            if content.get("type") == "questions":
                messages.append(AIMessage(content=json.dumps({
                    "action": "questions", "questions": content["questions"],
                })))
            elif content.get("type") == "section_content":
                messages.append(AIMessage(content=json.dumps({
                    "action": "content", "section_content": content["sectionContent"],
                })))

    # Add current turn with intent instructions
    intent = state.get("intent_instructions") or ""

    if state.get("question_answers"):
        formatted = "\n".join(
            f"- {a['question_id']}: {a['value']}"
            for a in state["question_answers"]
        )
        msg = f"Here are my answers:\n{formatted}\n\nPlease generate the content now."
        if intent:
            msg = f"{intent}\n\n{msg}"
        messages.append(HumanMessage(content=msg))
    elif state.get("regenerate"):
        msg = intent if intent else "Please regenerate the content with a different approach."
        messages.append(HumanMessage(content=msg))
    elif state.get("user_message", "").strip():
        msg = state["user_message"]
        if intent:
            msg = f"{intent}\n\nUser request: {msg}"
        messages.append(HumanMessage(content=msg))

    # Append tool results from previous iterations
    messages = _build_tool_messages(state, messages)

    logger.info("LLM (tools) request messages=%d iteration=%d", len(messages), state.get("tool_iteration", 0))
    response = llm_with_tools.invoke(messages)
    tc_count = len(response.tool_calls) if hasattr(response, "tool_calls") and response.tool_calls else 0
    content_type = type(response.content).__name__ if response.content else "None"
    logger.info("LLM (tools) response tool_calls=%d content_type=%s content=%r",
                tc_count, content_type, str(response.content)[:300] if response.content else "")
    return {"llm_response": response}


def route_output(state: SectionAuthorState) -> str:
    """Conditional edge: route to execute_tools or extract_raw_output."""
    response = state.get("llm_response")
    iteration = state.get("tool_iteration", 0)

    if (response
            and hasattr(response, "tool_calls")
            and response.tool_calls
            and iteration < MAX_TOOL_ITERATIONS):
        return "execute_tools"
    return "extract_raw_output"


def execute_tools(state: SectionAuthorState) -> dict:
    """Execute tool calls from the LLM response, with rate limiting."""
    response = state["llm_response"]
    tool_calls = response.tool_calls[:MAX_TOOL_CALLS_PER_ITERATION]
    tools = _get_tools(state)
    tool_map = {t.name: t for t in tools}

    web_search_count = state.get("web_search_count", 0)
    page_fetch_count = state.get("page_fetch_count", 0)

    results = []
    # Keep the AI message with tool_calls in the message history
    results.append(response)

    for tc in tool_calls:
        tool_name = tc["name"]
        tool_args = tc["args"]

        # Rate limiting for web tools
        if tool_name == "web_search" and web_search_count >= MAX_WEB_SEARCHES:
            results.append(ToolMessage(
                content="Rate limit reached: max web searches per session exceeded.",
                tool_call_id=tc["id"],
            ))
            continue
        if tool_name == "fetch_webpage" and page_fetch_count >= MAX_PAGE_FETCHES:
            results.append(ToolMessage(
                content="Rate limit reached: max page fetches per session exceeded.",
                tool_call_id=tc["id"],
            ))
            continue

        tool_fn = tool_map.get(tool_name)
        if not tool_fn:
            results.append(ToolMessage(
                content=f"Unknown tool: {tool_name}",
                tool_call_id=tc["id"],
            ))
            continue

        try:
            result = tool_fn.invoke(tool_args)
            results.append(ToolMessage(content=str(result), tool_call_id=tc["id"]))
            if tool_name == "web_search":
                web_search_count += 1
            elif tool_name == "fetch_webpage":
                page_fetch_count += 1
        except Exception as e:
            logger.warning("Tool %s failed: %s", tool_name, e)
            results.append(ToolMessage(
                content=f"Tool error: {e}. Try generating without this information.",
                tool_call_id=tc["id"],
            ))

    return {
        "tool_results": results,
        "tool_iteration": state.get("tool_iteration", 0) + 1,
        "web_search_count": web_search_count,
        "page_fetch_count": page_fetch_count,
    }


def extract_raw_output(state: SectionAuthorState) -> dict:
    """Extract text content from the LLM response for validate_output.

    If the LLM only returned tool_calls (no text), make one final call
    without tools to force a text response.
    """
    response = state.get("llm_response")
    if not response or not response.content:
        logger.warning("extract_raw_output: no response content")
        return {"llm_raw_output": ""}

    content = response.content
    raw = ""

    if isinstance(content, list):
        text_parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                continue
            if isinstance(block, dict) and "text" in block:
                text_parts.append(block["text"])
            elif isinstance(block, str):
                text_parts.append(block)
        raw = "\n".join(text_parts).strip()
    elif isinstance(content, str):
        raw = content.strip()

    # If we got no text (LLM only returned tool_calls), force a final call without tools
    if not raw:
        logger.info("extract_raw_output: no text in response, forcing final LLM call without tools")
        llm = get_llm(format="json")
        messages = [SystemMessage(content=state["system_prompt"])]
        # Add a summary of tool results as context
        tool_results = state.get("tool_results", [])
        tool_context = []
        for msg in tool_results:
            if hasattr(msg, "content") and isinstance(msg.content, str):
                tool_context.append(msg.content[:500])
        if tool_context:
            context_text = "\n---\n".join(tool_context)
            messages.append(HumanMessage(
                content=f"Here is research context I gathered:\n{context_text}\n\n"
                        f"Now generate your final response as JSON."
            ))
        else:
            messages.append(HumanMessage(content="Please generate your final response as JSON."))

        final_response = llm.invoke(messages)
        raw = final_response.content if isinstance(final_response.content, str) else str(final_response.content)
        logger.info("extract_raw_output: forced final call returned %d chars", len(raw))

    return {"llm_raw_output": raw}


def _build_linear_graph():
    """Original graph — no tools, JSON mode."""
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


def _build_tool_graph():
    """Tool-enabled graph — LLM can call tools in a loop."""
    graph = StateGraph(SectionAuthorState)
    graph.add_node("build_system_prompt", build_system_prompt)
    graph.add_node("classify_intent", classify_intent)
    graph.add_node("invoke_llm_with_tools", invoke_llm_with_tools)
    graph.add_node("execute_tools", execute_tools)
    graph.add_node("extract_raw_output", extract_raw_output)
    graph.add_node("validate_output", validate_output)

    graph.add_edge(START, "build_system_prompt")
    graph.add_edge("build_system_prompt", "classify_intent")
    graph.add_edge("classify_intent", "invoke_llm_with_tools")
    graph.add_conditional_edges("invoke_llm_with_tools", route_output, {
        "execute_tools": "execute_tools",
        "extract_raw_output": "extract_raw_output",
    })
    graph.add_edge("execute_tools", "invoke_llm_with_tools")
    graph.add_edge("extract_raw_output", "validate_output")
    graph.add_edge("validate_output", END)
    return graph.compile()


_linear_graph = None
_tool_graph = None


def _get_graph(tools_enabled: bool = False):
    global _linear_graph, _tool_graph
    if tools_enabled:
        if _tool_graph is None:
            _tool_graph = _build_tool_graph()
        return _tool_graph
    else:
        if _linear_graph is None:
            _linear_graph = _build_linear_graph()
        return _linear_graph


async def invoke_section_author(request: SectionAuthorRequest) -> SectionAuthorResponse:
    graph = _get_graph(request.tools_enabled)

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
        "tools_enabled": request.tools_enabled,
        "system_prompt": None,
        "intent_instructions": None,
        "llm_raw_output": None,
        "llm_response": None,
        "tool_results": [],
        "tool_iteration": 0,
        "web_search_count": 0,
        "page_fetch_count": 0,
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


# Stage mapping from node names to user-friendly stage events
_NODE_STAGE_MAP = {
    "build_system_prompt": "building_context",
    "classify_intent": "analyzing_intent",
    "invoke_llm": "generating",
    "invoke_llm_with_tools": "generating",
    "extract_raw_output": "generating",
    "validate_output": "validating",
}

# Tool name to stage mapping
_TOOL_STAGE_MAP = {
    "search_notes": "searching_notes",
    "find_related_notes": "searching_notes",
    "read_note": "reading_note",
    "web_search": "searching_web",
    "fetch_webpage": "fetching_page",
}


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def stream_section_author(request: SectionAuthorRequest):
    """Async generator that yields SSE events for each stage of section authoring."""
    graph = _get_graph(request.tools_enabled)

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
        "tools_enabled": request.tools_enabled,
        "system_prompt": None,
        "intent_instructions": None,
        "llm_raw_output": None,
        "llm_response": None,
        "tool_results": [],
        "tool_iteration": 0,
        "web_search_count": 0,
        "page_fetch_count": 0,
        "response_type": None,
        "questions": None,
        "section_content": None,
        "message": None,
        "message_severity": None,
        "explanation": None,
    }

    try:
        result = None
        async for event in graph.astream(initial_state):
            node_name = list(event.keys())[0]
            state_update = event[node_name]

            # Emit tool-specific stages for execute_tools
            if node_name == "execute_tools":
                # Inspect which tools were called from the LLM response
                llm_resp = state_update.get("tool_results", [])
                for msg in llm_resp:
                    if hasattr(msg, "tool_calls") and msg.tool_calls:
                        for tc in msg.tool_calls:
                            tool_stage = _TOOL_STAGE_MAP.get(tc["name"], "generating")
                            evt = {"stage": tool_stage, "tool": tc["name"]}
                            if "query" in tc.get("args", {}):
                                evt["query"] = tc["args"]["query"]
                            elif "topic" in tc.get("args", {}):
                                evt["query"] = tc["args"]["topic"]
                            yield _sse_event(evt)
                        break  # Only emit for the AI message with tool_calls
            else:
                stage = _NODE_STAGE_MAP.get(node_name)
                if stage:
                    yield _sse_event({"stage": stage})

            result = state_update

        # Build final response
        if result and result.get("response_type"):
            response = SectionAuthorResponse(
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
            yield _sse_event({"stage": "complete", "data": response.model_dump()})
        else:
            yield _sse_event({
                "stage": "error",
                "message": "No response generated.",
            })

    except TimeoutError:
        yield _sse_event({
            "stage": "error",
            "message": "The request timed out. Please try again.",
        })
    except Exception as e:
        err_str = str(e).lower()
        if "connection" in err_str or "refused" in err_str or "connect" in err_str:
            yield _sse_event({
                "stage": "error",
                "message": f"Cannot connect to the AI model server ({get_provider_name()}).",
            })
        else:
            logger.error("Stream error: %s", e, exc_info=True)
            yield _sse_event({
                "stage": "error",
                "message": "An unexpected error occurred.",
            })
