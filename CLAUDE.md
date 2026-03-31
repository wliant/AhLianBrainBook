# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BrainBook — a personal technical notebook. Spring Boot 3.5.13 (Java 21) app, Next.js 16 (React 19, TypeScript) web, FastAPI + LangGraph intelligence service (Python 3.12), PostgreSQL 16, MinIO for file storage, Ollama for local LLM inference.

## Environment Setup

The backend requires **Java 21** (Liberica JDK). Before running Gradle commands, configure the JDK:

```bash
# Bash (Git Bash / WSL) — must be sourced, not executed
source app/setup.sh

# PowerShell
. .\app\setup.ps1
```

Java 21 is installed at `D:\Installation\Java\liberica-21.0.5`. The setup scripts set `JAVA_HOME` and prepend the JDK `bin` to `PATH` for the current session.

## Commands

### Infrastructure
Always use `--env-file .env` when running docker compose:
```bash
docker compose --env-file .env -f docker-compose.infra.yml up -d          # postgres + minio + ollama
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
Brain → Cluster (nested tree via parent_id) → Neuron (rich text notes). Neurons support tags, attachments (MinIO), revisions (autosave/snapshot), links between neurons (manual + wiki-link `[[` syntax), favorites, pinning, and soft delete (trash). Cross-cutting features: Thoughts (tag-based filtered collections), Templates, Reminders, Notifications, AppSettings. Slash command menu (`/`) for inserting sections. Knowledge graph visualization. Import/export brains as JSON.

### App (`app/src/main/java/com/wliant/brainbook/`)
Standard layered Spring Boot: `controller/` → `service/` → `repository/` → `model/`. DTOs in `dto/`, config in `config/` (CORS, MinIO client). Database migrations via Flyway in `src/main/resources/db/migration/`. Neuron content stored as JSONB with a separate plain-text column for full-text search indexing.

### Intelligence Service (`intelligence-service/src/`)
Stateless FastAPI service for AI agent workflows. Uses LangGraph for agent orchestration and Ollama for local LLM inference. Structure: `routers/` (API endpoints) → `agents/` (LangGraph graphs) → `schemas/` (Pydantic models). Config via `pydantic-settings` in `config.py`.

### Web (`web/src/`)
Next.js App Router with nested routes: `app/brain/[brainId]/cluster/[clusterId]/neuron/[neuronId]/`. API client in `lib/api.ts` wraps fetch. Custom hooks in `lib/hooks/` (useBrains, useClusters, useNeurons). Rich text editor uses TipTap (`components/editor/`). UI built with Radix primitives + Tailwind CSS (`components/ui/`).

### Testing
- **App**: JUnit 5 + Spring Boot Test + TestContainers (PostgreSQL). Classical-school unit tests for services (real DB, only MinIO mocked). Integration tests for controllers (`@SpringBootTest` with `RANDOM_PORT` + `TestRestTemplate`). Requires Docker for TestContainers.
- **Web**: Vitest + React Testing Library + MSW (Mock Service Worker). Unit tests for API client, hooks, and components. Integration tests for pages with mocked backend APIs.
- **Intelligence Service**: pytest + httpx (FastAPI TestClient). All LLM calls mocked — no Ollama required for tests.
- **When testing**: Run only the relevant test package for the changes made (e.g., `./gradlew test --tests ClassName` or specific test files in web).
- **E2E tests**: Always rebuild and test using docker compose (`docker compose --env-file .env -f docker-compose.infra.yml -f docker-compose.app.yml up -d --build`).

### Key Config
- Backend port: 8080, Frontend port: 3000, Intelligence Service port: 8001
- MinIO API: 9000, Console: 9001, Ollama: 11434
- Max upload: 50MB
- Neuron optimistic locking via `version` field
- Frontend output mode: `standalone` (for Docker)
