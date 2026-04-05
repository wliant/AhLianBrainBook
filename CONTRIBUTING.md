# Contributing to BrainBook

Thanks for your interest in contributing. This document covers how to set up a local development environment and the guidelines for submitting changes.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker + Docker Compose | Latest | Required for infra and E2E tests |
| Java (Liberica JDK) | 21 | Backend only — set `JAVA_HOME` |
| Node.js | 22 | Frontend only |
| Python + uv | 3.12 | Intelligence service only |

---

## Local Dev Setup

### 1. Clone and configure

```bash
git clone https://github.com/wliant/AhLianBrainBook.git
cd AhLianBrainBook

cp .env.example .env
# Edit .env — set DB password, MinIO keys, LLM provider
```

### 2. Start infrastructure (PostgreSQL + MinIO)

```bash
docker compose --env-file .env -f docker-compose.infra.yml up -d
```

### 3. Run services locally

**Backend** (from `app/`):
```bash
# First session only — set JAVA_HOME
source scripts/setup.sh        # Bash / Git Bash
# or: . .\scripts\setup.ps1   # PowerShell

./gradlew bootRun
# Runs on http://localhost:8080
```

**Frontend** (from `web/`):
```bash
npm install
npm run dev
# Runs on http://localhost:3000
```

**Intelligence service** (from `intelligence-service/`):
```bash
uv sync --dev
uv run uvicorn src.main:app --reload --port 8001
# Runs on http://localhost:8001
```

---

## Project Structure

```
AhLianBrainBook/
├── app/                        # Spring Boot backend (Java 21)
│   └── src/main/java/.../
│       ├── controller/         # REST endpoints
│       ├── service/            # Business logic
│       ├── repository/         # JPA repositories
│       ├── model/              # JPA entities
│       └── dto/                # Request/response DTOs
│   └── src/main/resources/
│       └── db/migration/       # Flyway SQL migrations
│
├── web/                        # Next.js frontend (TypeScript)
│   └── src/
│       ├── app/                # App Router pages
│       ├── components/         # React components
│       │   ├── editor/         # TipTap section editors
│       │   └── ui/             # Radix UI primitives
│       └── lib/
│           ├── api.ts          # API client
│           └── hooks/          # React hooks
│
├── intelligence-service/       # FastAPI + LangGraph (Python 3.12)
│   └── src/
│       ├── routers/            # API endpoints
│       ├── agents/             # LangGraph agent graphs
│       ├── schemas/            # Pydantic models
│       └── config.py           # Settings (pydantic-settings)
│
├── sandbox-service/            # Go gRPC service for sandbox management
│   └── (git clone, branch switch, pull, file serving via gRPC)
│
├── proto/                      # Protocol Buffer definitions (gRPC)
│   └── sandbox/v1/             # Sandbox service proto schema
│
├── e2e-test/                   # Playwright + pytest E2E tests
├── scripts/                    # Dev setup scripts
└── docker-compose.*.yml        # Docker Compose files
```

---

## Running Tests

Run only the tests relevant to your changes.

**Backend** (requires Docker for TestContainers):
```bash
cd app/
./gradlew test                           # all tests
./gradlew test --tests ClassName         # single class
```

**Frontend**:
```bash
cd web/
npm test                                 # all tests
npm run test:watch                       # watch mode
```

**Intelligence service** (no Ollama needed — LLM calls are mocked):
```bash
cd intelligence-service/
uv run pytest
```

**E2E** (requires full stack running via Docker Compose):
```bash
docker compose --env-file .env -f docker-compose.infra.yml -f docker-compose.app.yml up -d --build
cd e2e-test/
uv run pytest
```

---

## Making Changes

1. **Branch** from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```

2. **Keep changes focused** — one feature or fix per PR. Avoid mixing refactors with behaviour changes.

3. **Database migrations** — add a new numbered Flyway file (`Vxx__description.sql`) under `app/src/main/resources/db/migration/`. Never edit existing migrations.

4. **Run relevant tests** before opening a PR.

5. **Open a pull request** against `main` with a clear description of what changed and why.

---

## Code Style

- **Java**: Standard Spring Boot conventions. No Lombok — use records and plain classes.
- **TypeScript**: ESLint (`npm run lint`). Prefer functional components and hooks.
- **Python**: `ruff` for linting; `uv run ruff check .` before committing.
