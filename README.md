# BrainBook

A personal technical notebook. Organize your knowledge into Brains, Clusters, and Neurons with rich content sections (rich text, code, math, diagrams, tables, images, callouts).

## Tech Stack

- **Backend**: Spring Boot 3.5.13 (Java 21), PostgreSQL 16, MinIO (S3-compatible file storage)
- **Frontend**: Next.js 16 (React 19, TypeScript), Tailwind CSS, Radix UI, TipTap editor
- **Testing**: JUnit 5 + TestContainers (backend), Vitest + React Testing Library + MSW (frontend), Playwright + pytest (E2E)

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Java 21 (for local backend development)
- Node.js 22 (for local frontend development)

### Run with Docker Compose (full stack)

```bash
docker compose -f docker-compose.infra.yml -f docker-compose.app.yml up -d
```

Open http://localhost:3000.

### Run infrastructure only (for local development)

```bash
docker compose -f docker-compose.infra.yml up -d
```

This starts PostgreSQL (15432) and MinIO (19000/19001).

### Backend (from `app/`)

```bash
./gradlew bootRun       # run on :8080
./gradlew test           # run tests (requires Docker for TestContainers)
```

### Frontend (from `web/`)

```bash
npm install
npm run dev              # dev server on :3000
npm test                 # run tests
```

### E2E Tests (from `e2e-test/`)

Requires the full stack running.

```bash
uv sync
uv run pytest
```

## Architecture

```
Brain
  └── Cluster (nested tree via parent_id)
        └── Neuron (rich content sections, tags, attachments, revisions)
```

- **Backend**: Controller → Service → Repository → Model. Flyway migrations. JSONB content storage with plain-text column for full-text search.
- **Frontend**: Next.js App Router with nested dynamic routes. TipTap + Monaco + Mermaid + KaTeX editors. Radix UI components.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/brainbook` | PostgreSQL connection |
| `MINIO_ENDPOINT` | `http://localhost:9000` | MinIO API endpoint |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Backend API URL for frontend |
