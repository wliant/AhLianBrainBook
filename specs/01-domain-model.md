# Domain Model

## Overview

BrainBook uses a hierarchical domain model: **Brain > Cluster > Neuron**. Neurons are the core content unit, supporting rich text, tags, attachments, revisions, and inter-neuron links.

## Entities

### Brain

Top-level organizational container (e.g., "Backend Engineering", "ML Research").

| Field       | Type            | Constraints              | Description                  |
|-------------|-----------------|--------------------------|------------------------------|
| id          | UUID            | PK, auto-generated       | Unique identifier            |
| name        | String(255)     | NOT NULL                 | Display name                 |
| icon        | String(50)      | nullable                 | Icon identifier              |
| color       | String(7)       | nullable                 | Hex color code (e.g. #FF0000)|
| sortOrder   | int             | NOT NULL, default 0      | Manual ordering position     |
| isArchived  | boolean         | NOT NULL, default false  | Soft archive flag            |
| createdAt   | LocalDateTime   | NOT NULL, auto-set       | Creation timestamp           |
| updatedAt   | LocalDateTime   | NOT NULL, auto-updated   | Last modification timestamp  |

### Cluster

Organizes neurons within a brain. Supports nesting via self-referential `parentClusterId`.

| Field            | Type            | Constraints                        | Description                     |
|------------------|-----------------|------------------------------------|---------------------------------|
| id               | UUID            | PK, auto-generated                 | Unique identifier               |
| brainId          | UUID            | NOT NULL, FK -> brains ON CASCADE  | Parent brain                    |
| name             | String(255)     | NOT NULL                           | Display name                    |
| parentClusterId  | UUID            | nullable, FK -> clusters           | Parent cluster (for nesting)    |
| sortOrder        | int             | NOT NULL, default 0                | Manual ordering position        |
| isArchived       | boolean         | NOT NULL, default false            | Soft archive flag               |
| createdAt        | LocalDateTime   | NOT NULL, auto-set                 | Creation timestamp              |
| updatedAt        | LocalDateTime   | NOT NULL, auto-updated             | Last modification timestamp     |

### Neuron

Core content entity. Stores rich text notes with dual-format content (JSON for rendering, plain text for search).

| Field         | Type            | Constraints                            | Description                          |
|---------------|-----------------|----------------------------------------|--------------------------------------|
| id            | UUID            | PK, auto-generated                     | Unique identifier                    |
| brainId       | UUID            | NOT NULL, FK -> brains                 | Parent brain                         |
| clusterId     | UUID            | nullable, FK -> clusters               | Parent cluster                       |
| title         | String(500)     | default ''                             | Note title                           |
| contentJson   | JSONB           | nullable                               | TipTap JSON (rich text structure)    |
| contentText   | TEXT            | nullable                               | Plain text for full-text search      |
| templateId    | UUID            | nullable, FK -> templates ON SET NULL  | Applied template                     |
| sortOrder     | int             | NOT NULL, default 0                    | Manual ordering position             |
| isFavorite    | boolean         | NOT NULL, default false                | Starred status                       |
| isPinned      | boolean         | NOT NULL, default false                | Pinned status                        |
| isArchived    | boolean         | NOT NULL, default false                | Soft archive flag                    |
| isDeleted     | boolean         | NOT NULL, default false                | Soft delete (trash)                  |
| version       | int             | NOT NULL, default 1                    | Optimistic locking version counter   |
| lastEditedAt  | LocalDateTime   | nullable, default NOW()                | Last content edit timestamp          |
| createdAt     | LocalDateTime   | NOT NULL, auto-set                     | Creation timestamp                   |
| updatedAt     | LocalDateTime   | NOT NULL, auto-updated                 | Last modification timestamp          |

**Indexes:**
- `idx_neurons_brain_id` on brain_id
- `idx_neurons_cluster_id` on cluster_id
- `idx_neurons_deleted` on is_deleted
- `idx_neurons_content_text` GIN index using `to_tsvector('english', content_text)` for full-text search

### Tag

Labels for cross-cutting categorization of neurons.

| Field     | Type            | Constraints              | Description          |
|-----------|-----------------|--------------------------|----------------------|
| id        | UUID            | PK, auto-generated       | Unique identifier    |
| name      | String(100)     | NOT NULL, UNIQUE         | Tag label            |
| color     | String(7)       | nullable                 | Hex color code       |
| createdAt | LocalDateTime   | NOT NULL, auto-set       | Creation timestamp   |
| updatedAt | LocalDateTime   | NOT NULL, auto-updated   | Last modification    |

**Join table** `neuron_tags`: (neuron_id, tag_id) composite PK, both FK with CASCADE delete.

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
| contentJson    | JSONB           | nullable                             | Snapshot of rich content    |
| contentText    | TEXT            | nullable                             | Snapshot of plain text      |
| createdAt      | LocalDateTime   | NOT NULL, auto-set                   | Snapshot timestamp          |

### NeuronLink

Bidirectional references between neurons.

| Field          | Type            | Constraints                              | Description        |
|----------------|-----------------|------------------------------------------|--------------------|
| id             | UUID            | PK, auto-generated                       | Unique identifier  |
| sourceNeuronId | UUID            | NOT NULL, FK -> neurons ON CASCADE       | Source neuron      |
| targetNeuronId | UUID            | NOT NULL, FK -> neurons ON CASCADE       | Target neuron      |
| createdAt      | LocalDateTime   | NOT NULL, auto-set                       | Link timestamp     |

**Constraint:** UNIQUE(source_neuron_id, target_neuron_id) -- no duplicate links.

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

## Entity Relationships

```
Brain (1) ──── (*) Cluster
  │                  │
  │                  ├── Cluster.parentClusterId -> Cluster (self-ref, tree)
  │                  │
  └──── (*) Neuron ──┘  (neuron belongs to brain AND optionally a cluster)
              │
              ├── (*) Tag          (many-to-many via neuron_tags)
              ├── (*) Attachment   (one-to-many)
              ├── (*) NeuronRevision (one-to-many)
              ├── (*) NeuronLink   (many-to-many, self-ref)
              └── (0..1) Template  (many-to-one, nullable)
```
