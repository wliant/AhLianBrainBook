# Domain Model

## Overview

BrainBook uses a hierarchical domain model: **Brain > Cluster > Neuron**. Neurons are the core content unit, supporting section-based rich content, tags, attachments, revisions, inter-neuron links, reminders, and complexity metadata. Cross-cutting features include thoughts (tag-based collections), notifications, and application settings.

## Entities

### Brain

Top-level organizational container (e.g., "Backend Engineering", "ML Research").

| Field          | Type            | Constraints              | Description                      |
|----------------|-----------------|--------------------------|----------------------------------|
| id             | UUID            | PK, auto-generated       | Unique identifier                |
| name           | String(255)     | NOT NULL                 | Display name                     |
| description    | TEXT            | nullable                 | Brain description                |
| icon           | String(50)      | nullable                 | Icon identifier                  |
| color          | String(7)       | nullable                 | Hex color code (e.g. #FF0000)    |
| sortOrder      | int             | NOT NULL, default 0      | Manual ordering position         |
| isArchived     | boolean         | NOT NULL, default false  | Soft archive flag                |
| createdBy      | String(100)     | NOT NULL, default 'user' | Display name of creator          |
| lastUpdatedBy  | String(100)     | NOT NULL, default 'user' | Display name of last editor      |
| createdAt      | LocalDateTime   | NOT NULL, auto-set       | Creation timestamp               |
| updatedAt      | LocalDateTime   | NOT NULL, auto-updated   | Last modification timestamp      |

**Join table** `brain_tags`: (brain_id, tag_id) composite PK, both FK with CASCADE delete.

### Cluster

Organizes neurons within a brain. Supports typed behavior via `type` field — each type determines the cluster's UI, content model, and capabilities.

| Field            | Type            | Constraints                        | Description                     |
|------------------|-----------------|------------------------------------|---------------------------------|
| id               | UUID            | PK, auto-generated                 | Unique identifier               |
| brainId          | UUID            | NOT NULL, FK -> brains ON CASCADE  | Parent brain                    |
| name             | String(255)     | NOT NULL                           | Display name                    |
| type             | String(20)      | NOT NULL, default 'knowledge'      | Cluster type: `knowledge`, `ai-research`, `project`, `todo` |
| status           | String(20)      | NOT NULL, default 'ready'          | Generation status: `generating`, `ready` |
| researchGoal     | TEXT            | nullable                           | LLM-generated research goal (ai-research clusters only) |
| sortOrder        | int             | NOT NULL, default 0                | Manual ordering position        |
| isArchived       | boolean         | NOT NULL, default false            | Soft archive flag               |
| createdBy        | String(100)     | NOT NULL, default 'user'           | Display name of creator         |
| lastUpdatedBy    | String(100)     | NOT NULL, default 'user'           | Display name of last editor     |
| createdAt        | LocalDateTime   | NOT NULL, auto-set                 | Creation timestamp              |
| updatedAt        | LocalDateTime   | NOT NULL, auto-updated             | Last modification timestamp     |

**Constraints:**
- CHECK: `type IN ('knowledge', 'ai-research', 'project', 'todo')`
- CHECK: `status IN ('generating', 'ready')`
- Partial unique index `uq_cluster_brain_ai_research`: one non-archived `ai-research` cluster per brain
- `todo` clusters are unique per brain (enforced in application layer via `ClusterType.isUnique()`)
- `todo` clusters are auto-named "Tasks" — no user name input required
- No uniqueness restriction on `project` or `knowledge` clusters — multiple per brain allowed

### ResearchTopic

AI-generated research topic within an ai-research cluster. Contains a hierarchical bullet tree tracking learning coverage. Separate from neurons — different content structure, behavior, and lifecycle.

| Field              | Type            | Constraints                              | Description                              |
|--------------------|-----------------|------------------------------------------|------------------------------------------|
| id                 | UUID            | PK, auto-generated                       | Unique identifier                        |
| clusterId          | UUID            | NOT NULL, FK -> clusters ON CASCADE      | Parent cluster (must be ai-research type)|
| brainId            | UUID            | NOT NULL, FK -> brains                   | Parent brain                             |
| title              | String(255)     | NOT NULL                                 | AI-generated topic title                 |
| prompt             | TEXT            | nullable                                 | User's original prompt for generation    |
| contentJson        | JSONB           | nullable                                 | Bullet tree structure (see format below) |
| overallCompleteness| String(20)      | NOT NULL, default 'none'                 | Aggregate completeness: `none`, `partial`, `good`, `complete` |
| status             | String(20)      | NOT NULL, default 'ready'                | Generation status: `generating`, `ready`, `updating`, `error` |
| lastRefreshedAt    | LocalDateTime   | nullable                                 | Last AI refresh timestamp                |
| sortOrder          | int             | NOT NULL, default 0                      | Manual ordering position                 |
| createdAt          | LocalDateTime   | NOT NULL, auto-set                       | Creation timestamp                       |
| updatedAt          | LocalDateTime   | NOT NULL, auto-updated                   | Last modification timestamp              |
| createdBy          | String(100)     | NOT NULL                                 | Display name of creator                  |
| lastUpdatedBy      | String(100)     | NOT NULL                                 | Display name of last editor              |

**Constraints:**
- CHECK: `overall_completeness IN ('none', 'partial', 'good', 'complete')`
- CHECK: `status IN ('generating', 'ready', 'updating', 'error')`

**Indexes:**
- `idx_research_topics_cluster` on `cluster_id`
- `idx_research_topics_brain` on `brain_id`

**Content JSON format:**
```json
{
  "version": 1,
  "items": [
    {
      "id": "string",
      "text": "Concept name",
      "explanation": "What to learn about it",
      "completeness": "none | partial | good | complete",
      "linkedNeuronIds": ["uuid"],
      "children": [ /* recursive BulletItem */ ]
    }
  ]
}
```

### Neuron

Core content entity. Stores section-based content with dual-format storage (JSON for rendering, plain text for search).

| Field          | Type            | Constraints                            | Description                              |
|----------------|-----------------|----------------------------------------|------------------------------------------|
| id             | UUID            | PK, auto-generated                     | Unique identifier                        |
| brainId        | UUID            | NOT NULL, FK -> brains                 | Parent brain                             |
| clusterId      | UUID            | nullable, FK -> clusters               | Parent cluster                           |
| title          | String(500)     | NOT NULL, default ''                   | Note title                               |
| contentJson    | JSONB           | nullable                               | Sections JSON (v2 format, see below)     |
| contentText    | TEXT            | nullable                               | Plain text for full-text search          |
| templateId     | UUID            | nullable, FK -> templates ON SET NULL  | Applied template                         |
| sortOrder      | int             | NOT NULL, default 0                    | Manual ordering position                 |
| isFavorite     | boolean         | NOT NULL, default false                | Starred status                           |
| isPinned       | boolean         | NOT NULL, default false                | Pinned status                            |
| isArchived     | boolean         | NOT NULL, default false                | Soft archive flag                        |
| isDeleted      | boolean         | NOT NULL, default false                | Soft delete (trash)                      |
| version        | int             | NOT NULL, default 1                    | Optimistic locking version counter       |
| complexity     | String(20)      | nullable                               | Complexity level: simple, moderate, complex |
| createdBy      | String(100)     | NOT NULL, default 'user'               | Display name of creator                  |
| lastUpdatedBy  | String(100)     | NOT NULL, default 'user'               | Display name of last editor              |
| lastEditedAt   | LocalDateTime   | nullable, default NOW()                | Last content edit timestamp              |
| createdAt      | LocalDateTime   | NOT NULL, auto-set                     | Creation timestamp                       |
| updatedAt      | LocalDateTime   | NOT NULL, auto-updated                 | Last modification timestamp              |

**Content JSON format (v2 — sections):**
```json
{
  "version": 2,
  "sections": [
    {
      "id": "uuid-string",
      "type": "rich-text | code | math | diagram | callout | table | image | audio | divider",
      "order": 0,
      "content": { /* type-specific content */ },
      "meta": {}
    }
  ]
}
```

**Indexes:**
- `idx_neurons_brain_id` on brain_id
- `idx_neurons_cluster_id` on cluster_id
- `idx_neurons_deleted` on is_deleted
- `idx_neurons_content_text` GIN index using `to_tsvector('english', content_text)` for full-text search
- `idx_neurons_title_text` GIN index using `to_tsvector('english', coalesce(title, ''))` for full-text search on title
- `idx_neurons_favorite` partial index on `is_favorite` WHERE `is_favorite = true AND is_deleted = false`
- `idx_neurons_pinned` partial index on `is_pinned` WHERE `is_pinned = true AND is_deleted = false`
- `idx_neurons_cluster_active` on `cluster_id` WHERE `is_deleted = false`
- Archived indexes on brains, clusters, neurons `is_archived` columns

### TodoMetadata

Task-specific metadata for neurons in todo clusters. One-to-one with Neuron, stored in a separate table to avoid polluting the core neuron model.

| Field        | Type            | Constraints                              | Description                              |
|--------------|-----------------|------------------------------------------|------------------------------------------|
| neuronId     | UUID            | PK, FK -> neurons ON DELETE CASCADE      | Parent neuron (shared primary key)       |
| dueDate      | DATE            | nullable                                 | Task deadline (date only, not datetime)  |
| completed    | boolean         | NOT NULL, default false                  | Whether task is done                     |
| completedAt  | LocalDateTime   | nullable                                 | When the task was marked complete        |
| effort       | String(10)      | nullable                                 | Estimated effort: `15min`, `30min`, `1hr`, `2hr`, `4hr`, `8hr` |
| priority     | String(20)      | NOT NULL, default 'normal'               | Priority level: `critical`, `important`, `normal` |
| createdAt    | LocalDateTime   | NOT NULL, auto-set                       | Creation timestamp                       |
| updatedAt    | LocalDateTime   | NOT NULL, auto-updated                   | Last modification timestamp              |

**Indexes:**
- `idx_todo_metadata_completed` on `completed`
- `idx_todo_metadata_due_date` on `due_date`

**Behavior:**
- When `completed` transitions to `true`, `completedAt` is auto-set to current time
- When `completed` transitions to `false`, `completedAt` is cleared
- When `dueDate` is set and task is not completed, a system reminder (RECURRING DAILY at 7pm local) is auto-created
- When task is completed or `dueDate` is cleared, the system reminder is deactivated

### Tag

Labels for cross-cutting categorization of neurons and brains.

| Field     | Type            | Constraints              | Description          |
|-----------|-----------------|--------------------------|----------------------|
| id        | UUID            | PK, auto-generated       | Unique identifier    |
| name      | String(100)     | NOT NULL, UNIQUE         | Tag label            |
| color     | String(7)       | nullable                 | Hex color code       |
| createdAt | LocalDateTime   | NOT NULL, auto-set       | Creation timestamp   |
| updatedAt | LocalDateTime   | NOT NULL, auto-updated   | Last modification    |

**Join tables:**
- `neuron_tags`: (neuron_id, tag_id) composite PK, both FK with CASCADE delete
- `brain_tags`: (brain_id, tag_id) composite PK, both FK with CASCADE delete

### Attachment

File metadata for neuron attachments stored in MinIO.

| Field       | Type            | Constraints                          | Description              |
|-------------|-----------------|--------------------------------------|--------------------------|
| id          | UUID            | PK, auto-generated                   | Unique identifier        |
| neuronId    | UUID            | NOT NULL, FK -> neurons ON CASCADE   | Parent neuron            |
| fileName    | String(255)     | NOT NULL                             | Original filename        |
| filePath    | String(500)     | NOT NULL                             | MinIO object key         |
| fileSize    | Long            | nullable                             | Size in bytes            |
| contentType | String(100)     | nullable                             | MIME type                |
| createdAt   | LocalDateTime   | NOT NULL, auto-set                   | Upload timestamp         |

### NeuronRevision

Content snapshots for version history.

| Field          | Type            | Constraints                          | Description                 |
|----------------|-----------------|--------------------------------------|-----------------------------|
| id             | UUID            | PK, auto-generated                   | Unique identifier           |
| neuronId       | UUID            | NOT NULL, FK -> neurons ON CASCADE   | Parent neuron               |
| revisionNumber | int             | NOT NULL                             | Sequential revision number  |
| title          | String(500)     | nullable                             | Snapshot of neuron title    |
| contentJson    | JSONB           | nullable                             | Snapshot of rich content    |
| contentText    | TEXT            | nullable                             | Snapshot of plain text      |
| createdAt      | LocalDateTime   | NOT NULL, auto-set                   | Snapshot timestamp          |

### NeuronLink

Directed, labeled connections between neurons. Used for knowledge graph visualization and relationship tracking.

| Field          | Type            | Constraints                              | Description                              |
|----------------|-----------------|------------------------------------------|------------------------------------------|
| id             | UUID            | PK, auto-generated                       | Unique identifier                        |
| sourceNeuronId | UUID            | NOT NULL, FK -> neurons ON CASCADE       | Source neuron                             |
| targetNeuronId | UUID            | NOT NULL, FK -> neurons ON CASCADE       | Target neuron                             |
| label          | String(255)     | nullable                                 | Human-readable edge label                |
| linkType       | String(50)      | nullable                                 | Edge category (e.g. references, depends-on, calls, contains) |
| weight         | Double          | default 1.0                              | Connection strength (0.0–1.0+)           |
| source         | String(20)      | NOT NULL, default 'manual'               | Origin: `manual` (AddLinkDialog) or `editor` (wiki-link `[[` syntax) |
| createdAt      | LocalDateTime   | NOT NULL, auto-set                       | Link timestamp                           |

**Constraints:**
- UNIQUE(source_neuron_id, target_neuron_id) — no duplicate links
- CHECK `check_no_self_link`: source_neuron_id must not equal target_neuron_id

### Template

Reusable content structures for creating neurons.

| Field       | Type            | Constraints              | Description                    |
|-------------|-----------------|--------------------------|--------------------------------|
| id          | UUID            | PK, auto-generated       | Unique identifier              |
| name        | String(255)     | NOT NULL                 | Template name                  |
| description | TEXT            | nullable                 | Template description           |
| contentJson | JSONB           | nullable                 | TipTap JSON content structure  |
| createdAt   | LocalDateTime   | NOT NULL, auto-set       | Creation timestamp             |
| updatedAt   | LocalDateTime   | NOT NULL, auto-updated   | Last modification timestamp    |

### Thought

Tag-based filtered collections of neurons. A thought defines criteria (neuron tags and/or brain tags with AND/OR matching) and dynamically resolves matching neurons.

| Field          | Type            | Constraints              | Description                                    |
|----------------|-----------------|--------------------------|------------------------------------------------|
| id             | UUID            | PK, auto-generated       | Unique identifier                              |
| name           | String(255)     | NOT NULL                 | Display name                                   |
| description    | TEXT            | nullable                 | Description of the thought                     |
| neuronTagMode  | String(10)      | NOT NULL, default 'any'  | Matching mode for neuron tags: `any` or `all`  |
| brainTagMode   | String(10)      | NOT NULL, default 'any'  | Matching mode for brain tags: `any` or `all`   |
| sortOrder      | int             | NOT NULL, default 0      | Manual ordering position                       |
| createdAt      | LocalDateTime   | NOT NULL, auto-set       | Creation timestamp                             |
| updatedAt      | LocalDateTime   | NOT NULL, auto-updated   | Last modification timestamp                    |

**Join tables:**
- `thought_neuron_tags`: (thought_id, tag_id) composite PK, both FK with CASCADE delete
- `thought_brain_tags`: (thought_id, tag_id) composite PK, both FK with CASCADE delete

### Reminder

Per-neuron reminders that trigger notifications. Multiple reminders per neuron are supported, up to a configurable limit (`AppSettings.maxRemindersPerNeuron`, default 10).

| Field              | Type              | Constraints                              | Description                              |
|--------------------|-------------------|------------------------------------------|------------------------------------------|
| id                 | UUID              | PK, auto-generated                       | Unique identifier                        |
| neuronId           | UUID              | NOT NULL, FK -> neurons ON CASCADE       | Parent neuron                            |
| reminderType       | ReminderType      | NOT NULL                                 | `ONCE` or `RECURRING`                    |
| triggerAt          | LocalDateTime     | NOT NULL                                 | Next trigger time                        |
| recurrencePattern  | RecurrencePattern | nullable                                 | `DAILY`, `WEEKLY`, or `MONTHLY`          |
| recurrenceInterval | Integer           | default 1, range 1–365                   | Number of periods between recurrences    |
| isActive           | boolean           | NOT NULL, default true                   | Whether reminder is active               |
| isSystem           | boolean           | NOT NULL, default false                  | System-generated (todo auto-reminders); hidden from user-facing reminder lists |
| title              | String(255)       | nullable                                 | Reminder title                           |
| description        | JSONB             | nullable                                 | Rich text description                    |
| descriptionText    | TEXT              | nullable                                 | Plain text description for display       |
| createdAt          | LocalDateTime     | NOT NULL, auto-set                       | Creation timestamp                       |
| updatedAt          | LocalDateTime     | NOT NULL, auto-updated                   | Last modification timestamp              |

**Indexes:**
- `idx_reminders_trigger` on `trigger_at` WHERE `is_active = TRUE`
- `idx_reminders_neuron_id` on `neuron_id`

**System reminders:** Reminders with `isSystem = true` are auto-managed by the todo feature. They are excluded from `GET /api/reminders` (the user-facing reminders page). The `TodoReminderService` creates, updates, and deactivates these based on todo metadata changes.

### Notification

Denormalized notification records generated by the reminder system. Includes navigation data so the frontend can link directly to the relevant neuron.

| Field        | Type            | Constraints                                  | Description                    |
|--------------|-----------------|----------------------------------------------|--------------------------------|
| id           | UUID            | PK, auto-generated                           | Unique identifier              |
| reminderId   | UUID            | nullable, FK -> reminders ON DELETE SET NULL  | Source reminder                 |
| neuronId     | UUID            | NOT NULL, FK -> neurons ON DELETE CASCADE     | Related neuron                  |
| brainId      | UUID            | NOT NULL                                     | Brain ID for navigation        |
| clusterId    | UUID            | NOT NULL                                     | Cluster ID for navigation      |
| neuronTitle  | String(500)     | NOT NULL                                     | Neuron title at notification time |
| message      | TEXT            | NOT NULL                                     | Notification message text      |
| isRead       | boolean         | NOT NULL, default false                      | Read status                    |
| createdAt    | LocalDateTime   | NOT NULL, auto-set                           | Creation timestamp             |

**Index:** `idx_notifications_unread` on `(is_read, created_at DESC)`

### SpacedRepetitionItem

Tracks SM-2 spaced repetition scheduling per neuron. One item per neuron.

| Field          | Type            | Constraints                                  | Description                              |
|----------------|-----------------|----------------------------------------------|------------------------------------------|
| id             | UUID            | PK, auto-generated                           | Unique identifier                        |
| neuronId       | UUID            | NOT NULL, FK -> neurons ON CASCADE, UNIQUE   | Parent neuron (one SR item per neuron)   |
| easeFactor     | double          | NOT NULL, default 2.5                        | SM-2 ease factor (minimum 1.3)           |
| intervalDays   | int             | NOT NULL, default 0                          | Days until next review                   |
| repetitions    | int             | NOT NULL, default 0                          | Consecutive correct repetitions          |
| nextReviewAt   | LocalDateTime   | NOT NULL                                     | When the item is next due for review     |
| lastReviewedAt | LocalDateTime   | nullable                                     | Last review timestamp                    |
| createdAt      | LocalDateTime   | NOT NULL, auto-set                           | Creation timestamp                       |
| updatedAt      | LocalDateTime   | NOT NULL, auto-updated                       | Last modification timestamp              |

**Constraint:** UNIQUE(neuron_id) — one spaced repetition item per neuron.
**Index:** `idx_sr_next_review` on `next_review_at`

### ReviewQuestion

Pre-generated Q&A pairs for spaced repetition review. Questions are generated by the intelligence service and cached via content hash to avoid regeneration when neuron content hasn't changed.

| Field        | Type            | Constraints                                  | Description                        |
|--------------|-----------------|----------------------------------------------|------------------------------------|
| id           | UUID            | PK, auto-generated                           | Unique identifier                  |
| srItemId     | UUID            | NOT NULL, FK -> spaced_repetition_items ON CASCADE | Parent SR item             |
| neuronId     | UUID            | NOT NULL, FK -> neurons ON CASCADE           | Source neuron                      |
| questionText | TEXT            | NOT NULL                                     | Generated question                 |
| answerText   | TEXT            | NOT NULL                                     | Generated answer                   |
| sortOrder    | int             | NOT NULL, default 0                          | Display order                      |
| contentHash  | String(64)      | nullable                                     | Hash of source content at generation time |
| status       | String(20)      | NOT NULL, default 'ready'                    | `ready`, `stale`                   |
| createdAt    | LocalDateTime   | NOT NULL, auto-set                           | Creation timestamp                 |
| updatedAt    | LocalDateTime   | NOT NULL, auto-updated                       | Last modification timestamp        |

**Indexes:** `idx_review_questions_sr_item` on `sr_item_id`, `idx_review_questions_neuron` on `neuron_id`

### LinkSuggestion

AI-generated link recommendations between neurons, powered by wiki-link reference extraction and vector embedding similarity.

| Field            | Type            | Constraints                              | Description                              |
|------------------|-----------------|------------------------------------------|------------------------------------------|
| id               | UUID            | PK, auto-generated                       | Unique identifier                        |
| sourceNeuronId   | UUID            | NOT NULL, FK -> neurons ON CASCADE       | Neuron that owns the suggestion          |
| targetNeuronId   | UUID            | NOT NULL, FK -> neurons ON CASCADE       | Suggested target neuron                  |
| suggestionType   | String(30)      | NOT NULL                                 | `reference` (wiki-link) or `related-to` (embedding similarity) |
| score            | Double          | nullable                                 | Similarity score (for `related-to` type) |
| status           | String(20)      | NOT NULL, default 'pending'              | `pending`, `accepted`, `dismissed`       |
| createdAt        | LocalDateTime   | NOT NULL, auto-set                       | Creation timestamp                       |

**Constraints:** UNIQUE(source_neuron_id, target_neuron_id)

### NeuronEmbedding

Vector embeddings for neurons, stored via pgvector. Used for similarity-based link suggestions.

| Field       | Type            | Constraints                              | Description                        |
|-------------|-----------------|------------------------------------------|------------------------------------|
| id          | UUID            | PK, auto-generated                       | Unique identifier                  |
| neuronId    | UUID            | NOT NULL, FK -> neurons ON CASCADE, UNIQUE | Source neuron                    |
| embedding   | vector(768)     | NOT NULL                                 | Embedding vector (nomic-embed-text) |
| modelName   | String(100)     | NOT NULL                                 | Model used to generate embedding   |
| createdAt   | LocalDateTime   | NOT NULL, auto-set                       | Creation timestamp                 |
| updatedAt   | LocalDateTime   | NOT NULL, auto-updated                   | Last modification timestamp        |

**Index:** HNSW index on `embedding` using vector cosine distance for efficient similarity search.

**Infrastructure:** Requires PostgreSQL pgvector extension (`CREATE EXTENSION IF NOT EXISTS vector`).

### NeuronShare

Token-based read-only sharing of individual neurons with optional expiration.

| Field     | Type            | Constraints                                | Description                        |
|-----------|-----------------|--------------------------------------------|------------------------------------|
| id        | UUID            | PK, auto-generated                         | Unique identifier                  |
| neuronId  | UUID            | NOT NULL, FK -> neurons ON CASCADE         | Shared neuron                      |
| token     | String(64)      | NOT NULL, UNIQUE                           | Random hex token for public access |
| expiresAt | LocalDateTime   | nullable                                   | Expiration time (null = never)     |
| createdAt | LocalDateTime   | NOT NULL, auto-set                         | Creation timestamp                 |

**Indexes:** `idx_neuron_shares_token` on `token`, `idx_neuron_shares_neuron_id` on `neuron_id`

### AppSettings

Singleton application-wide settings. Contains one row seeded at migration time.

| Field                  | Type            | Constraints                | Description                              |
|------------------------|-----------------|----------------------------|------------------------------------------|
| id                     | UUID            | PK, auto-generated         | Unique identifier                        |
| displayName            | String(100)     | NOT NULL, default 'user'   | User's display name                      |
| maxRemindersPerNeuron  | int             | NOT NULL, default 10       | Max reminders per neuron (range 1–100)   |
| timezone               | String(50)      | NOT NULL, default 'Asia/Singapore' | IANA timezone for local-time reminder scheduling |
| createdAt              | LocalDateTime   | NOT NULL, auto-set         | Creation timestamp                       |
| updatedAt              | LocalDateTime   | NOT NULL, auto-updated     | Last modification timestamp              |

## Entity Relationships

```
Brain (1) ──── (*) Cluster (typed: knowledge | ai-research | project | todo)
  │                  │
  │                  ├── (*) ResearchTopic    (one-to-many, ai-research clusters only)
  │                  ├── (1) ProjectConfig    (one-to-one, project clusters only; see 06-project-cluster.md)
  │                  ├── (0..1) Sandbox       (one-to-one, project clusters only; see 06-project-cluster.md)
  │                  ├── (*) NeuronAnchor     (one-to-many, project clusters only; see 06-project-cluster.md)
  │                  │
  └──── (*) Neuron ──┘  (neuron belongs to brain AND optionally a cluster)
              │
              ├── (*) Tag                    (many-to-many via neuron_tags)
              ├── (*) Attachment             (one-to-many)
              ├── (*) NeuronRevision         (one-to-many)
              ├── (*) NeuronLink             (many-to-many, self-ref, directed)
              ├── (*) LinkSuggestion         (one-to-many, AI-generated link recommendations)
              ├── (0..1) NeuronEmbedding     (one-to-one, vector embedding for similarity)
              ├── (*) Reminder               (one-to-many, max per AppSettings)
              ├── (*) Notification           (one-to-many)
              ├── (0..1) SpacedRepetitionItem (one-to-one)
              │           └── (*) ReviewQuestion  (one-to-many, AI-generated Q&A)
              ├── (*) NeuronShare            (one-to-many)
              ├── (0..1) TodoMetadata        (one-to-one, todo cluster neurons only)
              └── (0..1) Template            (many-to-one, nullable)

Brain (*) ──── (*) Tag  (many-to-many via brain_tags)

Thought ──── (*) Tag  (many-to-many via thought_neuron_tags)
         └── (*) Tag  (many-to-many via thought_brain_tags)

Reminder (1) ──── (*) Notification

AppSettings  (singleton, no relationships)
```
