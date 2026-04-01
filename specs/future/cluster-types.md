# Cluster Types

## Context

BrainBook is a learning platform for technical people. Clusters currently serve only as folders of neurons (free-form notes). Different learning activities have fundamentally different workflows — studying a topic, having AI map out what to learn, exploring a real codebase. Cluster types formalize these as distinct learning activities within a brain.

## Brain / Cluster Relationship

- **Brain** = a subject domain (e.g., "Legacy Systems", "Data Structures & Algorithms")
- **Cluster** = a learning activity within that domain, with a specific type that determines its UI, behavior, and data model

## Types

| Type | Purpose | Content | Who authors |
|------|---------|---------|-------------|
| **Knowledge** | Free-form note-taking | Neurons with sections (rich-text, code, math, etc.) | Human (AI assists per-section) |
| **AI Research** | AI-generated learning tracker | Neurons with structured bullet points + completeness tracking | AI (user triggers and curates) |
| **Project** | Codebase exploration | Git-managed source code, no neurons | Git remote (user navigates) |

## Data Model Changes

### Cluster

Add a `type` field to the cluster model:

```
type VARCHAR(20) NOT NULL DEFAULT 'knowledge'
```

Valid values: `knowledge`, `ai-research`, `project`.

### Constraints

- Only **one AI Research cluster** per brain
- Only **one Project cluster** per brain (one repo per cluster)
- Knowledge clusters: unlimited per brain

### Cluster Page Routing

The cluster page component checks the cluster type and renders the appropriate UI:
- `knowledge` → current neuron list + section editor
- `ai-research` → AI Research view (see ai-research-cluster.md)
- `project` → Code explorer view (see project-cluster.md)
