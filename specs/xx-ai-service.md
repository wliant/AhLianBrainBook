# AI Service

## Overview

Stateless FastAPI service providing AI agent capabilities for BrainBook via LangGraph. Supports Ollama for local LLM inference and Anthropic (Claude) as a cloud LLM provider. Provider is selected via configuration. No persistent storage — all state is scoped to individual requests.

## Architecture

| Component       | Technology         | Purpose                        |
|-----------------|---------------------|--------------------------------|
| API Framework   | FastAPI             | HTTP endpoints, OpenAPI docs   |
| Agent Runtime   | LangGraph           | Agent workflow orchestration   |
| LLM Provider    | Ollama / Anthropic  | LLM inference (local via Ollama or cloud via Anthropic API) |
| LLM Abstraction | `src/llm.py`        | `get_llm()` factory returns ChatOllama or ChatAnthropic based on config |
| Package Manager | uv                  | Dependency management          |

### Project Structure

```
intelligence-service/
├── src/
│   ├── main.py          # FastAPI app, middleware
│   ├── config.py        # Pydantic Settings (LLM provider, URLs, keys)
│   ├── llm.py           # LLM provider factory (get_llm → ChatOllama or ChatAnthropic)
│   ├── routers/         # API endpoint handlers
│   ├── agents/          # LangGraph agent definitions
│   │   ├── placeholder.py
│   │   ├── section_author.py
│   │   ├── research_goal_generator.py
│   │   ├── research_topic_generator.py
│   │   ├── research_topic_scorer.py
│   │   └── research_bullet_expander.py
│   └── schemas/         # Request/response models
│       ├── agents.py
│       ├── section_author.py
│       ├── research.py
│       └── health.py
├── tests/               # pytest test suite
├── Dockerfile           # Multi-stage production build
└── pyproject.toml       # Dependencies (uv)
```

## API Endpoints

| Method | Path                                   | Request Body                 | Response Body                | Description                         |
|--------|----------------------------------------|------------------------------|------------------------------|-------------------------------------|
| GET    | /health                                | —                            | `HealthResponse`             | Service + LLM provider health check |
| POST   | /api/agents/invoke                     | `{ input, agent_type }`      | `{ output, agent_type }`     | Invoke a generic agent              |
| POST   | /api/agents/section-author             | `SectionAuthorRequest`       | `SectionAuthorResponse`      | AI section authoring                |
| POST   | /api/agents/research-goal-generator    | `GenerateGoalRequest`        | `GenerateGoalResponse`       | Generate research goal for cluster  |
| POST   | /api/agents/research-topic-generator   | `GenerateTopicRequest`       | `GenerateTopicResponse`      | Generate bullet tree for a topic    |
| POST   | /api/agents/research-topic-scorer      | `ScoreTopicRequest`          | `ScoreTopicResponse`         | Re-score completeness + discover links |
| POST   | /api/agents/research-bullet-expander   | `ExpandBulletRequest`        | `ExpandBulletResponse`       | Expand bullet into sub-points       |

### POST /api/agents/invoke

Dispatches the request to the agent identified by `agent_type`. The agent processes the input through a LangGraph workflow and returns the result.

**Request:**

```json
{
  "input": "Summarize the key points of this topic",
  "agent_type": "placeholder"
}
```

**Response:**

```json
{
  "output": "Here are the key points...",
  "agent_type": "placeholder"
}
```

**Errors:**

| Status | Condition                          |
|--------|------------------------------------|
| 422    | Validation error (missing fields)  |
| 500    | Unknown agent_type or LLM failure  |

### POST /api/agents/section-author

AI-assisted section content authoring. Supports multi-turn conversations where the agent can ask clarifying questions before generating content.

**Supported section types:** rich-text, code, math, diagram, callout, table.

**Request (`SectionAuthorRequest`):**

```json
{
  "section_type": "code",
  "current_content": { "code": "", "language": "javascript" },
  "user_message": "Write a fibonacci function",
  "conversation_history": [],
  "question_answers": null,
  "regenerate": false,
  "context": {
    "neuron_id": "uuid",
    "neuron_title": "Algorithm Notes",
    "section_id": "s1",
    "brain_name": "CS Fundamentals",
    "cluster_name": "Algorithms",
    "tags": ["algorithms", "recursion"],
    "sibling_sections_summary": [
      { "section_id": "s0", "section_type": "rich-text", "order": 0, "preview": "Introduction to common algorithms..." }
    ]
  }
}
```

**Response (`SectionAuthorResponse`):**

The agent returns one of three response types:

| `response_type` | Description | Key fields |
|-----------------|-------------|------------|
| `questions` | Agent needs clarification | `questions[]` |
| `content` | Agent generated section content | `section_content` |
| `message` | Informational or error message | `message`, `message_severity` |

**Questions response:**

```json
{
  "response_type": "questions",
  "questions": [
    { "id": "q1", "text": "Which approach?", "input_type": "single-select", "options": ["Recursive", "Iterative", "Memoized"], "required": true },
    { "id": "q2", "text": "Include type hints?", "input_type": "single-select", "options": ["Yes", "No"], "required": true },
    { "id": "q3", "text": "Any specific constraints?", "input_type": "free-text", "required": false }
  ],
  "explanation": "A few questions to tailor the implementation."
}
```

**Content response (section_content matches the section type's schema):**

```json
{
  "response_type": "content",
  "section_content": { "code": "def fibonacci(n):\n    ...", "language": "python" },
  "explanation": "Generated a recursive fibonacci function."
}
```

**Message response:**

```json
{
  "response_type": "message",
  "message": "Cannot connect to the AI model server (Ollama).",
  "message_severity": "error"
}
```

**Conversation protocol:**

The service is stateless. Full conversation history is round-tripped on each request. The backend appends user and assistant turns before returning to the frontend.

| Turn | From | Content type |
|------|------|-------------|
| 1 | User | `{ type: "text", text: "..." }` |
| 2 | Agent | `{ type: "questions", questions: [...] }` or `{ type: "section_content", sectionContent: {...} }` |
| 3 | User | `{ type: "answers", answers: [...] }` or `{ type: "text", text: "make it shorter" }` |
| ... | ... | continues until user saves or closes |

**Question input types:**

| `input_type` | UI rendering | Answer value type |
|--------------|-------------|------------------|
| `single-select` | Radio buttons | `string` |
| `multi-select` | Checkboxes | `string[]` |
| `free-text` | Text input | `string` |

**Special operations:**

- **Regenerate**: `regenerate: true` — agent retries with a different approach
- **Undo**: Frontend-only — maintains a stack of generated content versions

**Backend proxy (Spring Boot):**

`POST /api/neurons/{neuronId}/sections/{sectionId}/ai-assist`

The backend enriches the request with `NeuronContext` (title, brain name, cluster name, tags, sibling section summaries) fetched from the database, then forwards to the intelligence service.

## Agent Workflow Patterns

Agents are defined as LangGraph `StateGraph` instances. Each agent follows this pattern:

1. Define a `TypedDict` state schema (typically with a `messages` list)
2. Build a `StateGraph` with nodes for each processing step
3. Compile the graph into a runnable
4. Export an `async` invocation function

### Placeholder Agent

The simplest agent — a single LLM call:

```
START → invoke_llm → END
```

State: `{ messages: list[BaseMessage] }`

### Section Author Agent

Multi-turn agent that helps users write section content:

```
START → build_system_prompt → classify_intent → invoke_llm → validate_output → END
```

- **build_system_prompt**: Constructs system prompt from section type, content schema, neuron context, and conversation history
- **classify_intent**: Routes to generate/refine/clarify based on conversation state
- **invoke_llm**: Calls the configured LLM provider with `format="json"` for structured output
- **validate_output**: Parses JSON, validates against section type schema, fills defaults

State: `section_type, current_content, user_message, conversation_history, question_answers, context, regenerate` → `response_type, questions|section_content|message, explanation`

### Research Goal Generator

Generates a research goal string for a new AI Research cluster.

```
START → build_prompt → invoke_llm → validate → END
```

- **Input** (`GenerateGoalRequest`): `{ brain_name, neurons: NeuronSummary[] }`
- **Output** (`GenerateGoalResponse`): `{ research_goal }`
- Single LLM call. Produces a 1-2 sentence research goal based on the brain's name and existing knowledge neuron summaries.

### Research Topic Generator

Generates a structured bullet tree for a research topic.

```
START → build_prompt → invoke_llm → validate → END
```

- **Input** (`GenerateTopicRequest`): `{ prompt, context: BrainContext }`
- **Output** (`GenerateTopicResponse`): `{ title, items: BulletItem[], overall_completeness }`
- Uses brain context (name, research goal, neuron summaries) to generate relevant bullet points with initial completeness scores and linked neuron IDs.

### Research Topic Scorer

Re-scores completeness levels and discovers new neuron links for existing bullet trees.

```
START → build_prompt → invoke_llm → validate → END
```

- **Input** (`ScoreTopicRequest`): `{ items: BulletItem[], context: BrainContext }`
- **Output** (`ScoreTopicResponse`): `{ items: BulletItem[], overall_completeness }`
- AI re-scans brain's knowledge neurons, updates completeness levels, and discovers new linked neuron IDs.

### Research Bullet Expander

Expands a single bullet point into finer sub-points.

```
START → build_prompt → invoke_llm → validate → END
```

- **Input** (`ExpandBulletRequest`): `{ bullet: BulletItem, parent_context, context: BrainContext }`
- **Output** (`ExpandBulletResponse`): `{ children: BulletItem[] }`

### Shared Research Types

```python
class NeuronSummary:
    neuron_id: str
    title: str
    content_preview: str  # first 500 chars of contentText

class BrainContext:
    brain_name: str
    research_goal: str
    neurons: list[NeuronSummary]

class BulletItem:
    id: str
    text: str
    explanation: str
    completeness: str  # none | partial | good | complete
    linked_neuron_ids: list[str]
    children: list[BulletItem]
```

### Adding New Agents

1. Create a new module in `src/agents/` with a `StateGraph` and an async invoke function
2. Register the agent in `src/routers/agents.py` in the `AGENT_REGISTRY` dict
3. Add tests in `tests/` with mocked LLM calls

## Configuration

| Variable          | Required                  | Default                    | Description                           |
|-------------------|---------------------------|----------------------------|---------------------------------------|
| LLM_PROVIDER      | No                        | ollama                     | LLM provider: `ollama` or `anthropic` |
| OLLAMA_BASE_URL   | No                        | http://ollama:11434        | Ollama server URL                     |
| OLLAMA_MODEL      | No                        | llama3.2                   | Default Ollama model for agents       |
| ANTHROPIC_API_KEY  | When provider=anthropic  | (empty)                    | Anthropic API key                     |
| ANTHROPIC_MODEL   | No                        | claude-sonnet-4-20250514   | Anthropic model name                  |
| BRAINBOOK_API_URL | No                        | http://app:8080            | Backend API URL (for agent tool use)  |
| AGENT_TIMEOUT     | No                        | 600                        | Agent execution timeout in seconds    |

## Infrastructure

### Docker

- **Internal port**: 8001
- **Dev host port**: 28001 (via `INTELLIGENCE_PORT` in `.env`)
- **Image**: `python:3.12-slim` (multi-stage build with uv)
- **Health check**: `GET /health`

### LLM Providers

**Ollama (default):** Runs as a separate infrastructure service alongside PostgreSQL and MinIO. Models are persisted in a Docker volume (`ollama-data`). After starting infrastructure, pull the desired model:

```bash
docker exec brainbook3-ollama ollama pull llama3.2
```

**Anthropic:** Set `LLM_PROVIDER=anthropic` and provide `ANTHROPIC_API_KEY`. No local Ollama instance required. The health endpoint reports `not_configured` if the API key is missing.

**Health check response:**
```json
{
  "status": "ok",
  "llm_provider": "ollama | anthropic",
  "llm_status": "ok | unavailable | not_configured"
}
```
- Ollama: pings the Ollama server, returns `ok` or `unavailable`
- Anthropic: checks if API key is configured, returns `ok` or `not_configured`

## Testing

- **Framework**: pytest + httpx (FastAPI TestClient)
- **Strategy**: All LLM calls are mocked in unit tests — no Ollama required
- **Run**: `cd intelligence-service && uv run pytest`
