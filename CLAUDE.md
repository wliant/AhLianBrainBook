# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BrainBook — a personal technical notebook. Spring Boot 3.5.13 (Java 21) app, Next.js 16 (React 19, TypeScript) web, FastAPI + LangGraph intelligence service (Python 3.12), PostgreSQL 16, MinIO for file storage, Ollama for local LLM inference.

## Environment Setup

Fix dev environment related issue by running

```bash
# Bash (Git Bash / WSL) — must be sourced, not executed
source scripts/setup.sh

# PowerShell
. .\scripts\setup.ps1
```

Scripts are gitignored. On first setup, copy from the example files:
```bash
cp scripts/setup.sh.example scripts/setup.sh
cp scripts/setup.ps1.example scripts/setup.ps1
```

Java 21 is installed at `D:\Installation\Java\liberica-21.0.5`. The setup scripts set `JAVA_HOME` and prepend the JDK `bin` to `PATH` for the current session.

## Commands

### Infrastructure
Always use `--env-file .env` when running docker compose:
```bash
docker compose --env-file .env -f docker-compose.infra.yml up -d          # postgres + minio
docker compose --env-file .env -f docker-compose.infra.yml -f docker-compose.app.yml up -d  # full stack
```

### App (from `app/`)
```bash
./gradlew bootRun               # run locally (needs postgres + minio running)
./gradlew bootJar -x test       # build JAR
./gradlew test                  # run all tests
./gradlew test --tests ClassName # run single test class
```

### Web (from `web/`)
```bash
npm install
npm run dev       # dev server on :3000
npm run build     # production build
npm run lint      # next lint
npm test          # run all tests
npm run test:watch # watch mode
```

### Intelligence Service (from `intelligence-service/`)
```bash
uv sync --dev             # install dependencies
uv run uvicorn src.main:app --reload --port 8001  # dev server on :8001
uv run pytest             # run all tests
```

## Architecture

### Domain Model
Brain → Cluster (nested tree via parent_id) → Neuron (rich text notes). Cluster types: `knowledge` (default), `ai-research` (one per brain, AI-generated topics), `project` (code-anchored notes with sandbox), `todo` (one per brain, lightweight task management). Neurons support tags, attachments (MinIO), revisions (autosave/snapshot), links between neurons (manual + wiki-link `[[` syntax), favorites, pinning, and soft delete (trash). Todo neurons have separate `todo_metadata` (due date, priority, effort, completion) with auto-generated RECURRING DAILY reminders at 7pm local time for overdue tasks. Cross-cutting features: Thoughts (tag-based filtered collections), Templates, Reminders, Notifications, AppSettings (display name, max reminders, timezone, AI tools toggle). Slash command menu (`/`) for inserting sections. Knowledge graph visualization. Import/export brains as JSON.

### App (`app/src/main/java/com/wliant/brainbook/`)
Standard layered Spring Boot: `controller/` → `service/` → `repository/` → `model/`. DTOs in `dto/`, config in `config/` (CORS, MinIO client). Database migrations via Flyway in `src/main/resources/db/migration/`. Neuron content stored as JSONB with a separate plain-text column for full-text search indexing. Internal API at `/api/internal/*` for intelligence service tool callbacks (search, similar, neuron content), secured via `X-Internal-Key` header. `ContextAssemblyService` for RAG retrieval (embeddings + links + cluster siblings). SSE streaming via `SseEmitter` relay for AI assist stage indicators.

### Intelligence Service (`intelligence-service/src/`)
Stateless FastAPI service for AI agent workflows. Uses LangGraph for agent orchestration and Ollama for local LLM inference. Structure: `routers/` (API endpoints) → `agents/` (LangGraph graphs) → `schemas/` (Pydantic models) → `tools/` (LangChain tools for KB search and web search). Config via `pydantic-settings` in `config.py`. `get_llm(temperature?, max_tokens?)` factory in `llm.py` returns ChatOllama or ChatAnthropic with per-agent tuning. Section author agent has two graph variants: linear (JSON mode, no tools) and tool-enabled (with tool loop, max 3 iterations). SSE streaming endpoint at `/api/agents/section-author/stream` for real-time stage indicators. Research agents: goal generator (temp 0.7), topic generator (temp 0.4, with self-critique step at temp 0.2, dedup, quality validation), topic scorer (temp 0.1, 2000-char previews), bullet expander (temp 0.4). Context includes neuron tags and existing topic titles for deduplication.

### Sandbox Service (`sandbox-service/`)
Go microservice that provisions and manages git sandboxes for Project clusters. Communicates with the Spring Boot backend over gRPC. Handles repo cloning, branch switching, pull operations, file serving, and sandbox cleanup. Proto definitions live in `proto/sandbox/v1/`. Runs as a sidecar container in Docker Compose.

### Web (`web/src/`)
Next.js App Router with nested routes: `app/brain/[brainId]/cluster/[clusterId]/neuron/[neuronId]/`. API client in `lib/api.ts` wraps fetch (includes SSE stream parser for AI assist). Custom hooks in `lib/hooks/` (useBrains, useClusters, useNeurons, useTodoMetadata, useAiAssist with streaming + cancellation). Rich text editor uses TipTap (`components/editor/`). AI assist dialog (`components/sections/AiAssistDialog.tsx`) with side-by-side preview, stage indicators, read-only TipTap rich-text preview, explanation toggles, and cancel button. Cluster-type-specific views: `components/research/` (AI research), `components/project/` (code sandbox), `components/todo/` (task management — TodoClusterView, TodoTaskRow, TodoMetadataEditor, TasksPanel, TaskOverviewRow). Cross-brain `/tasks` overview page aggregates todos across all brains, sorted by due date (overdue collapsed to yesterday), priority, then effort. UI built with Radix primitives + Tailwind CSS (`components/ui/`).

### Responsive Design
- Minimum supported viewport: **360px**. Tailwind breakpoints: `sm` 640, `md` 768, `lg` 1024.
- Dialogs: use the `<DialogContent>` primitive as-is — it caps to `w-[calc(100vw-2rem)]` and `max-h-[calc(100dvh-2rem)]` by default. Override sizes only with `sm:max-w-*` / `sm:max-h-*` so mobile inherits the safe default.
- Side panels on the neuron page and similar layouts: wrap in `<ResponsiveSidePanel>` (`components/ui/ResponsiveSidePanel.tsx`) — bottom sheet on mobile, right column on `lg`.
- Popovers anchored to the right edge: use `w-[calc(100vw-2rem)] sm:w-*` so they can't overflow.
- Prefer CSS-based responsiveness (`hidden lg:flex`, `md:block`, etc.). Only reach for `useMediaQuery` / `useIsDesktop` / `useIsTablet` (`lib/hooks/useMediaQuery.ts`) when JS must know the viewport (conditional mount, resize-handle gating).
- Avoid fixed pixel widths for panels. Gate pixel resize handles (e.g. `useResizeHandle`) behind `md:` / `lg:` so they don't activate on mobile.
- Manual test viewports: **360×640** (small phone), **768×1024** (tablet), **1280×800** (desktop baseline).

### Testing
- **App**: JUnit 5 + Spring Boot Test + TestContainers (PostgreSQL). Classical-school unit tests for services (real DB, only MinIO mocked). Integration tests for controllers (`@SpringBootTest` with `RANDOM_PORT` + `TestRestTemplate`). Requires Docker for TestContainers.
- **Web**: Vitest + React Testing Library + MSW (Mock Service Worker). Unit tests for API client, hooks, and components. Integration tests for pages with mocked backend APIs.
- **Intelligence Service**: pytest + httpx (FastAPI TestClient). All LLM calls mocked — no Ollama required for tests.
- **When testing**: Run only the relevant test package for the changes made (e.g., `./gradlew test --tests ClassName` or specific test files in web).
- **E2E tests**: Always rebuild and test using docker compose (`docker compose --env-file .env -f docker-compose.infra.yml -f docker-compose.app.yml up -d --build`).

### Key Config
- Backend port: 8080, Frontend port: 3000, Intelligence Service port: 8001
- MinIO API: 9000, Console: 9001
- Ollama: external (configured via `OLLAMA_BASE_URL` in `.env`)
- LLM max tokens: configurable via `LLM_MAX_TOKENS` (default 4096); per-agent overrides via `MAX_TOKENS_*` and `TEMPERATURE_*` env vars
- AI tools: Tavily web search (optional, `TAVILY_API_KEY`), DuckDuckGo fallback
- Internal API auth: `INTERNAL_API_KEY` (blank = dev mode, no auth)
- Max upload: 50MB
- Neuron optimistic locking via `version` field
- Frontend output mode: `standalone` (for Docker)
