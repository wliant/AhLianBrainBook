# Infrastructure Specification

## Services

| Service              | Technology        | Internal Port | Default Host Port | Purpose                              |
|----------------------|-------------------|---------------|-------------------|--------------------------------------|
| app                  | Spring Boot 3.5   | 8080          | 18080             | Backend REST API                     |
| web                  | Next.js 16        | 3000          | 13000             | Frontend web application             |
| intelligence-service | FastAPI + LangGraph | 8001        | 18001             | AI agent service                     |
| postgres             | PostgreSQL 16     | 5432          | 15432             | Primary database                     |
| minio                | MinIO             | 9000, 9001    | 19000, 19001      | Object storage (attachments)         |
| ollama               | Ollama            | 11434         | 11434             | Local LLM inference (external/host)  |

Host ports are configurable via `.env` file (`APP_PORT`, `WEB_PORT`, `POSTGRES_PORT`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT`).

## Docker Compose Files

### `docker-compose.infra.yml`
Infrastructure services only (postgres + minio). Used for local development where app and web run natively.

```bash
docker compose -f docker-compose.infra.yml up -d
```

### `docker-compose.app.yml`
Application services (app + web). Layered on top of infra for full-stack Docker deployment.

```bash
docker compose -f docker-compose.infra.yml -f docker-compose.app.yml up -d
```

### `docker-compose.prod.yml`
Production deployment configuration.

## Database

- **Engine:** PostgreSQL 16
- **Database name:** brainbook
- **Credentials:** brainbook / brainbook (local dev)
- **Migrations:** Flyway (auto-run on app startup)
- **Migration files:** `app/src/main/resources/db/migration/V*.sql`

### Migration History

| Version | Description                                      |
|---------|--------------------------------------------------|
| V1      | Initial schema — brains, clusters, neurons, tags, neuron_tags, attachments, neuron_revisions, neuron_links, templates |
| V2      | Align column names with JPA entity field names   |
| V3      | Migrate neuron content from TipTap doc format to v2 sections format (also migrates revision snapshots) |
| V4      | Add partial indexes on `is_archived` for brains, clusters, neurons |
| V5      | Add `description` (TEXT) column to brains table  |
| V6      | Add `brain_tags` join table (brain_id, tag_id)   |
| V7      | Add `label`, `link_type`, `weight` columns to neuron_links |
| V8      | Add `complexity` (VARCHAR 20) column to neurons  |
| V9      | Add `thoughts`, `thought_neuron_tags`, `thought_brain_tags` tables |
| V10     | Add `reminders` and `notifications` tables with indexes |
| V11     | Add `created_by`, `last_updated_by` to brains/clusters/neurons; add `app_settings` table with seeded default row |
| V12     | Add `title` column to neuron_revisions (renamed from duplicate V11) |
| V13     | Add GIN index on `title` for full-text search (`idx_neurons_title_text`) |
| V14     | Add `source` column (VARCHAR 20, default 'manual') to neuron_links — tracks manual vs editor wiki-link origins |
| V15     | Add `editor_mode` column to app_settings (later removed in V19) |
| V16     | Add `spaced_repetition_items` table with SM-2 fields (ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at), UNIQUE on neuron_id |
| V17     | Add `neuron_shares` table with token-based sharing (token VARCHAR 64 UNIQUE, expires_at nullable) |
| V18     | Drop UNIQUE constraint on reminders.neuron_id (allows multiple reminders per neuron); add `max_reminders_per_neuron` (default 10) to app_settings |
| V19     | Drop `editor_mode` column from app_settings (vim mode feature removed) |
| V20     | Add edge-case constraints: neuron self-link prevention (`check_no_self_link`), parent cluster ON DELETE SET NULL, partial indexes on favorites/pinned/active neurons, reminders neuron_id index |
| V21     | Remove cluster nesting: drop `parent_cluster_id` column, its foreign key, and self-parent constraint |
| V22     | Add cluster types: `type` column (knowledge/ai-research/project) with CHECK constraint, partial unique indexes limiting one ai-research and one project cluster per brain |
| V23     | Add AI research: `research_goal` column on clusters, new `research_topics` table with bullet tree content (JSONB), completeness tracking, and indexes |
| V24     | Add status fields: `status` column on clusters (generating/ready) and research_topics (generating/ready/updating/error) |

### Content Format (v2 — Sections)

Neuron content uses a sections-based JSON format (migrated from raw TipTap doc format in V3):

```json
{
  "version": 2,
  "sections": [
    {
      "id": "uuid-string",
      "type": "rich-text",
      "order": 0,
      "content": { /* TipTap JSON or type-specific data */ },
      "meta": {}
    }
  ]
}
```

Section types: `rich-text`, `code`, `math`, `diagram`, `callout`, `table`, `image`, `audio`, `divider`.

### Full-Text Search

PostgreSQL tsvector index on `neurons.content_text`:
```sql
CREATE INDEX idx_neurons_content_text ON neurons USING gin(to_tsvector('english', content_text));
```

Queried via `to_tsquery('english', ?)` in the search service.

### Key Indexes

- `idx_neurons_brain_id` on `neurons.brain_id`
- `idx_neurons_cluster_id` on `neurons.cluster_id`
- `idx_neurons_deleted` on `neurons.is_deleted`
- `idx_neurons_content_text` GIN index for full-text search
- `idx_neurons_title_text` GIN index for full-text search on title
- Partial indexes on `is_archived` for brains, clusters, neurons
- `idx_reminders_trigger` on `reminders.trigger_at` WHERE `is_active = TRUE`
- `idx_notifications_unread` on `notifications(is_read, created_at DESC)`
- `idx_sr_next_review` on `spaced_repetition_items.next_review_at`
- `idx_neuron_shares_token` on `neuron_shares.token`
- `idx_neuron_shares_neuron_id` on `neuron_shares.neuron_id`
- `idx_neurons_favorite` partial index on `neurons.is_favorite` WHERE `is_favorite = true AND is_deleted = false`
- `idx_neurons_pinned` partial index on `neurons.is_pinned` WHERE `is_pinned = true AND is_deleted = false`
- `idx_neurons_cluster_active` on `neurons.cluster_id` WHERE `is_deleted = false`
- `idx_reminders_neuron_id` on `reminders.neuron_id`
- `idx_research_topics_cluster` on `research_topics.cluster_id`
- `idx_research_topics_brain` on `research_topics.brain_id`

## Object Storage (MinIO)

- **Endpoint:** `http://minio:9000` (Docker) / `http://localhost:9000` (host)
- **Console:** `http://localhost:9001`
- **Bucket:** `brainbook-attachments`
- **Credentials:** brainbook / brainbook123 (local dev)
- **Max upload size:** 50MB (configured in Spring Boot)

### File Storage Pattern

Files are stored with a UUID-prefixed key to avoid collisions:
```
{uuid}/{original-filename}
```

The `filePath` field in the `attachments` table stores this MinIO object key.

## Scheduled Services

The backend runs scheduled background tasks:

| Service | Purpose |
|---------|---------|
| `NeuronSnapshotSchedulerService` | Periodically creates automatic revision snapshots of neuron content |
| `ReminderSchedulerService` | Scans for reminders whose `triggerAt` has passed and triggers notification generation |
| `ReminderProcessingService` | Processes triggered reminders: creates notification records, reschedules recurring reminders (advances `triggerAt` by recurrence interval), deactivates one-time reminders |

## Environment Variables

### Backend (Spring Boot)

| Variable                       | Default Value                              |
|--------------------------------|--------------------------------------------|
| SPRING_DATASOURCE_URL          | jdbc:postgresql://postgres:5432/brainbook  |
| SPRING_DATASOURCE_USERNAME     | brainbook                                  |
| SPRING_DATASOURCE_PASSWORD     | brainbook                                  |
| SPRING_FLYWAY_ENABLED          | true                                       |
| MINIO_ENDPOINT                 | http://minio:9000                          |
| MINIO_BUCKET                   | brainbook-attachments                      |
| MINIO_ACCESS_KEY               | brainbook                                  |
| MINIO_SECRET_KEY               | brainbook123                               |

### Intelligence Service (FastAPI)

| Variable                       | Default Value                              |
|--------------------------------|--------------------------------------------|
| LLM_PROVIDER                   | ollama                                     |
| OLLAMA_BASE_URL                | http://ollama:11434                        |
| OLLAMA_MODEL                   | llama3.2                                   |
| ANTHROPIC_API_KEY              | (empty, required when LLM_PROVIDER=anthropic) |
| ANTHROPIC_MODEL                | claude-sonnet-4-20250514                   |
| BRAINBOOK_API_URL              | http://app:8080                            |
| AGENT_TIMEOUT                  | 600                                        |

### Frontend (Next.js)

| Variable              | Default Value            |
|-----------------------|--------------------------|
| NEXT_PUBLIC_API_URL   | http://localhost:8080     |

## Build & Run

### Backend (`app/`)
```bash
source app/setup.sh                     # set JAVA_HOME (Java 21 / Liberica JDK)
./gradlew bootRun                        # dev server (needs infra running)
./gradlew bootJar -x test               # build JAR
./gradlew test                           # run tests (needs Docker for TestContainers)
./gradlew test --tests ClassName         # single test class
```

### Frontend (`web/`)
```bash
npm install           # install dependencies
npm run dev           # dev server on :3000
npm run build         # production build (standalone output)
npm run lint          # ESLint via next lint
npm test              # run tests (Vitest)
npm run test:watch    # watch mode
```

## CORS

Configured in `app/src/main/java/com/wliant/brainbook/config/` to allow the frontend origin to access the backend API. The allowed origin is set via `CORS_ALLOWED_ORIGINS` environment variable (default: `http://localhost:13000`).

## Testing Infrastructure

### Backend
- **Framework:** JUnit 5 + Spring Boot Test
- **Database:** TestContainers (PostgreSQL) — requires Docker
- **Approach:** Classical-school unit tests with real DB; only MinIO is mocked
- **Integration tests:** `@SpringBootTest` with `RANDOM_PORT` + `TestRestTemplate`

### Frontend
- **Framework:** Vitest + React Testing Library
- **API mocking:** MSW (Mock Service Worker)
- **Approach:** Unit tests for API client, hooks, components; integration tests for pages

### E2E
- Full-stack tests use Docker Compose: `docker compose -f docker-compose.infra.yml -f docker-compose.app.yml up -d --build`
