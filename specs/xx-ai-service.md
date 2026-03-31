# AI Service

## Overview

Stateless FastAPI service providing AI agent capabilities for BrainBook via LangGraph. Uses Ollama for local LLM inference. No persistent storage — all state is scoped to individual requests.

## Architecture

| Component       | Technology       | Purpose                        |
|-----------------|------------------|--------------------------------|
| API Framework   | FastAPI          | HTTP endpoints, OpenAPI docs   |
| Agent Runtime   | LangGraph        | Agent workflow orchestration   |
| LLM Provider    | Ollama           | Local language model inference |
| Package Manager | uv               | Dependency management          |

### Project Structure

```
intelligence-service/
├── src/
│   ├── main.py          # FastAPI app, middleware
│   ├── config.py        # Pydantic Settings
│   ├── routers/         # API endpoint handlers
│   ├── agents/          # LangGraph agent definitions
│   └── schemas/         # Request/response models
├── tests/               # pytest test suite
├── Dockerfile           # Multi-stage production build
└── pyproject.toml       # Dependencies (uv)
```

## API Endpoints

| Method | Path                 | Request Body                          | Response Body                     | Description              |
|--------|----------------------|---------------------------------------|-----------------------------------|--------------------------|
| GET    | /health              | —                                     | `{ status: string }`              | Service health check     |
| POST   | /api/agents/invoke   | `{ input: string, agent_type: string }` | `{ output: string, agent_type: string }` | Invoke an agent workflow |

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

### Adding New Agents

1. Create a new module in `src/agents/` with a `StateGraph` and an async invoke function
2. Register the agent in `src/routers/agents.py` in the `AGENT_REGISTRY` dict
3. Add tests in `tests/` with mocked LLM calls

## Configuration

| Variable          | Required | Default              | Description                           |
|-------------------|----------|----------------------|---------------------------------------|
| OLLAMA_BASE_URL   | No       | http://ollama:11434  | Ollama server URL                     |
| OLLAMA_MODEL      | No       | llama3.2             | Default model for agents              |
| BRAINBOOK_API_URL | No       | http://app:8080      | Backend API URL (for agent tool use)  |

## Infrastructure

### Docker

- **Internal port**: 8001
- **Dev host port**: 28001 (via `INTELLIGENCE_PORT` in `.env`)
- **Image**: `python:3.12-slim` (multi-stage build with uv)
- **Health check**: `GET /health`

### Ollama

Ollama runs as a separate infrastructure service alongside PostgreSQL and MinIO. Models are persisted in a Docker volume (`ollama-data`).

After starting infrastructure, pull the desired model:

```bash
docker exec brainbook3-ollama ollama pull llama3.2
```

## Testing

- **Framework**: pytest + httpx (FastAPI TestClient)
- **Strategy**: All LLM calls are mocked in unit tests — no Ollama required
- **Run**: `cd intelligence-service && uv run pytest`
