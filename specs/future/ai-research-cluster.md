# AI Research Cluster

## Context

BrainBook is a personal technical notebook. A **Brain** is a subject domain (e.g., "Spring Security", "Distributed Systems"). Users write **knowledge neurons** — notes, explanations, code examples — capturing what they've learned.

The **AI Research cluster** is a learning gap analysis tool. It answers: *"For this domain, what should I know, and how much of it have I actually written about?"* AI maps out what the user needs to learn and tracks coverage against their knowledge neurons. This creates a feedback loop: write knowledge → AI scores your coverage → you see gaps → you write more.

Only one AI Research cluster can exist per brain.

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data model | Separate `research_topics` table | Knowledge neurons and research topics have fundamentally different content structures, behavior, and lifecycle. Sharing the neurons table would require guards on every endpoint and leave many fields unused. |
| Scoring | Discrete levels: `none`, `partial`, `good`, `complete` | LLMs (especially local models) can't reliably distinguish 35% from 45%. Discrete levels are honest about capability and still provide useful signal. |
| Token strategy | Truncate + summarize | Send first 500 chars of each knowledge neuron's contentText. Simple, works within context limits. |
| Cluster metadata | `research_goal` text field | LLM-generated on cluster creation, user-editable. Provides overarching context for all topic generation and scoring. |

## Research Goal

Each AI Research cluster has a **research goal** — a 1-2 sentence description of what the user aims to learn in this brain's domain. It is:
- **Auto-generated** by the LLM when the cluster is created (based on the brain's name and existing knowledge neurons)
- **User-editable** after creation
- **Fed into context** for all research topic generation and scoring

Example: *"Understand Spring Security well enough to design and implement authentication and authorization for enterprise Java applications."*

## How It Works

### Research Topic Lifecycle

1. **User triggers creation** — clicks "New Research Topic" with a prompt (e.g., "Refactoring techniques")
2. **AI generates the topic** — produces a structured bullet tree covering what the user should learn, with initial completeness scores based on existing knowledge
3. **Each bullet point has:**
   - Text (concept name)
   - Explanation (what to learn about it)
   - Completeness level (`none` / `partial` / `good` / `complete`)
   - Links to relevant knowledge neurons (auto-discovered)
   - Optional children (sub-points)
4. **User triggers refresh** — AI re-scans the brain's knowledge, updates completeness levels, and discovers new links

### User Capabilities

| Action | Allowed |
|--------|---------|
| Create new research topic (triggers AI) | Yes |
| Delete a research topic | Yes |
| Reorder research topics | Yes |
| Edit topic content (bullets, text) | No — AI-managed |
| Expand a bullet into finer sub-points | Yes — triggers AI |
| Trigger refresh (re-score completeness) | Yes |
| Edit the cluster's research goal | Yes |

### Completeness Scoring

Discrete levels rated by AI based on how thoroughly the brain's knowledge neurons cover each point:

- **none** — no coverage found anywhere in the brain
- **partial** — mentioned or touched on, but lacking depth or detail
- **good** — explained with reasonable depth, examples present, minor gaps
- **complete** — thoroughly covered with depth, examples, and connections

AI determines the level by analyzing the `contentText` of all knowledge neurons across all knowledge clusters in the brain. Each neuron's content is truncated to the first 500 characters for the scoring pass.

### Link Discovery

During generation and refresh, AI automatically:
- Scans all knowledge neurons in the brain
- Matches bullet points to relevant neurons based on content similarity
- Attaches neuron IDs to matching bullet points
- Links are read-only references (user cannot manually add/remove them)
- Stale links (deleted neurons) are cleaned up on refresh

## Data Model

### Cluster Extension

Add to the `clusters` table:
```
research_goal TEXT  -- nullable, only used for ai-research type
```

### Research Topics Table

A dedicated table (NOT sharing the neurons table):

```sql
CREATE TABLE research_topics (
    id UUID PRIMARY KEY,
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    brain_id UUID NOT NULL REFERENCES brains(id),
    title VARCHAR(255) NOT NULL,
    prompt TEXT,
    content_json JSONB,
    overall_completeness VARCHAR(20) NOT NULL DEFAULT 'none',
    last_refreshed_at TIMESTAMP,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    created_by VARCHAR(100) NOT NULL,
    last_updated_by VARCHAR(100) NOT NULL,
    CONSTRAINT check_completeness CHECK (overall_completeness IN ('none', 'partial', 'good', 'complete'))
);
```

### Content JSON Structure

```json
{
  "version": 1,
  "items": [
    {
      "id": "item-1",
      "text": "Extract Method",
      "explanation": "Moving a code fragment into a separate method with a name that explains its purpose.",
      "completeness": "good",
      "linkedNeuronIds": ["uuid-1", "uuid-2"],
      "children": [
        {
          "id": "item-1-1",
          "text": "When to extract",
          "explanation": "Signs that a method is doing too much.",
          "completeness": "partial",
          "linkedNeuronIds": ["uuid-1"],
          "children": []
        }
      ]
    }
  ]
}
```

## API Endpoints

### Backend (Spring Boot)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/clusters/{id}/research-topics` | List research topics |
| POST | `/api/clusters/{id}/research-topics` | Create (triggers AI generation) |
| GET | `/api/clusters/{id}/research-topics/{topicId}` | Get single topic |
| DELETE | `/api/clusters/{id}/research-topics/{topicId}` | Delete topic |
| POST | `/api/clusters/{id}/research-topics/reorder` | Reorder topics |
| POST | `/api/clusters/{id}/research-topics/refresh` | Refresh all (re-score) |
| POST | `/api/clusters/{id}/research-topics/{topicId}/refresh` | Refresh single topic |
| POST | `/api/clusters/{id}/research-topics/{topicId}/expand` | Expand a bullet |

### Intelligence Service (FastAPI)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/agents/research-goal-generator` | Generate research goal for new cluster |
| POST | `/api/agents/research-topic-generator` | Generate bullet tree for a topic |
| POST | `/api/agents/research-topic-scorer` | Re-score completeness and discover links |
| POST | `/api/agents/research-bullet-expander` | Expand a bullet into sub-points |

## Intelligence Service Agents

### research-goal-generator
- **Input:** brain name, knowledge neuron summaries
- **Output:** research goal string (1-2 sentences)
- **LangGraph:** build_prompt → invoke_llm → validate → END

### research-topic-generator
- **Input:** topic prompt, research goal, brain context (neuron summaries)
- **Output:** title + bullet tree with initial completeness scores and linked neuron IDs
- **LangGraph:** build_prompt → invoke_llm → validate → END

### research-topic-scorer
- **Input:** existing bullet tree, brain context
- **Output:** updated bullet tree with new scores + linked neuron IDs + overall completeness
- **LangGraph:** build_prompt → invoke_llm → validate → END

### research-bullet-expander
- **Input:** bullet context (parent + existing children), brain context
- **Output:** new child bullets with scores
- **LangGraph:** build_prompt → invoke_llm → validate → END

## Token Budget

Scoring scans the entire brain's knowledge content. Strategy:
- Use `contentText` (plain text) for all knowledge neurons
- Truncate each neuron to the first 500 characters
- Include neuron title alongside the preview
- Pass the research goal as additional context
- For very large brains (100+ neurons), this may still approach context limits — future optimization could use embedding-based pre-filtering

## UI

### Cluster Page View

```
┌──────────────────────────────────────────────────┐
│  Brain > AI Research                   [Refresh] │
├──────────────────────────────────────────────────┤
│  Research Goal:                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ Understand Spring Security well enough to   │ │
│  │ design auth for enterprise applications.    │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ Refactoring Techniques ──────── good ─────┐ │
│  │  ● Extract Method              complete     │ │
│  │    ├─ When to extract          partial      │ │
│  │    └─ Mechanics                none         │ │
│  │  ● Inline Method               none         │ │
│  │  ● Rename Variable             good         │ │
│  │    └─ linked: "Naming Conventions" →        │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ Design Patterns ──────────────── none ────┐ │
│  │  ...                                        │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  [+ New Research Topic]                           │
└──────────────────────────────────────────────────┘
```

### Completeness Color Coding

| Level | Color | Display |
|-------|-------|---------|
| none | Gray | Empty indicator |
| partial | Yellow/Amber | Quarter-filled |
| good | Blue | Three-quarter filled |
| complete | Green | Full indicator |
