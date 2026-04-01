# AI Research Cluster

## Context

A learning tracker where AI maps out what the user needs to learn and tracks progress by scanning knowledge authored across the brain. The user triggers neuron creation, AI generates structured content, and completeness percentages update as the user writes knowledge neurons elsewhere in the brain.

Only one AI Research cluster can exist per brain.

## How It Works

### Neuron Lifecycle

1. **User triggers creation** — clicks "New Research Neuron" with an optional prompt (e.g., "Refactoring techniques", "Spring Security fundamentals")
2. **AI generates the neuron** — produces a structured list of bullet points and sub-bullets covering what the user should learn about the topic
3. **Each bullet point has:**
   - Explanation text
   - Completeness percentage (0–100%) — AI-rated based on how well the brain's existing knowledge covers this point
   - Links to relevant knowledge neurons (auto-discovered by AI)
4. **User triggers refresh** — AI re-scans the entire brain's content, updates completeness percentages, and discovers new links to knowledge neurons written since the last refresh

### User Capabilities

| Action | Allowed |
|--------|---------|
| Create new research neuron (triggers AI) | Yes |
| Delete a research neuron | Yes |
| Reorder research neurons | Yes |
| Edit neuron content (bullets, text) | No — AI-managed |
| Expand a bullet into finer sub-points | Yes — triggers AI to break it down further |
| Trigger refresh (re-score completeness) | Yes |
| Add own neurons to this cluster | No |

### Completeness Scoring

The completeness percentage is granular, rated by AI based on how thoroughly the brain's knowledge neurons cover each point:

- **0%** — no coverage found anywhere in the brain
- **10–30%** — mentioned briefly or tangentially in a knowledge neuron
- **40–60%** — explained with some depth but missing details, examples, or nuance
- **70–90%** — well covered with explanations and examples, minor gaps remain
- **100%** — thoroughly covered with depth, examples, and connections

AI determines the score by analyzing the `contentText` of all knowledge neurons across all knowledge clusters in the brain.

### Link Discovery

During generation and refresh, AI automatically:
- Scans all knowledge neurons in the brain
- Matches bullet points to relevant neurons based on content similarity
- Attaches links from bullet points to the matching knowledge neurons
- Links are read-only references (user cannot manually add/remove them)

## Neuron Data Structure

An AI Research neuron has a different content structure from a knowledge neuron:

```json
{
  "version": 1,
  "prompt": "Refactoring techniques",
  "items": [
    {
      "id": "item-1",
      "text": "Extract Method",
      "explanation": "Moving a code fragment into a separate method with a name that explains its purpose.",
      "completeness": 75,
      "linkedNeuronIds": ["uuid-1", "uuid-2"],
      "children": [
        {
          "id": "item-1-1",
          "text": "When to extract",
          "explanation": "Signs that a method is doing too much: long methods, comments explaining what a block does, duplicate code blocks.",
          "completeness": 40,
          "linkedNeuronIds": ["uuid-1"],
          "children": []
        },
        {
          "id": "item-1-2",
          "text": "Mechanics",
          "explanation": "Step-by-step: identify fragment, create new method, copy code, replace original with call, adjust variables.",
          "completeness": 0,
          "linkedNeuronIds": [],
          "children": []
        }
      ]
    },
    {
      "id": "item-2",
      "text": "Inline Method",
      "explanation": "Replacing a method call with the method's body when the body is as clear as the name.",
      "completeness": 0,
      "linkedNeuronIds": [],
      "children": []
    }
  ],
  "lastRefreshedAt": "2026-04-01T10:30:00Z"
}
```

## UI Concept

### Cluster Page View

```
┌──────────────────────────────────────────────────┐
│  Brain > AI Research                    [Refresh] │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌─ Refactoring Techniques ──────────── 38% ──┐  │
│  │                                             │  │
│  │  ● Extract Method                    75%    │  │
│  │    ├─ When to extract                40%    │  │
│  │    └─ Mechanics                       0%    │  │
│  │  ● Inline Method                      0%    │  │
│  │  ● Rename Variable                   90%    │  │
│  │    └─ linked: "Naming Conventions"   →      │  │
│  │  ...                                        │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─ Design Patterns in Legacy Code ──── 15% ──┐  │
│  │  ...                                        │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  [+ New Research Neuron]                          │
└──────────────────────────────────────────────────┘
```

### Neuron Detail View

Expanding a research neuron shows:
- Full bullet tree with explanations
- Completeness bar per bullet
- Linked knowledge neurons as clickable references
- "Expand" button on any bullet to request finer sub-points from AI
- "Refresh" button to re-score this neuron's completeness
- Overall neuron completeness (average or weighted)

## Backend / Intelligence Service

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/clusters/{id}/research-neurons` | Create new research neuron (triggers AI generation) |
| POST | `/api/clusters/{id}/research-neurons/refresh` | Refresh all neurons in the cluster (re-score completeness) |
| POST | `/api/clusters/{id}/research-neurons/{neuronId}/refresh` | Refresh single neuron |
| POST | `/api/clusters/{id}/research-neurons/{neuronId}/expand` | Expand a bullet point into sub-points |
| DELETE | `/api/clusters/{id}/research-neurons/{neuronId}` | Delete a research neuron |
| POST | `/api/clusters/{id}/research-neurons/reorder` | Reorder research neurons |

### Intelligence Service Agents

**`research-neuron-generator`** — generates the initial bullet point tree for a topic:
- Input: topic prompt, brain context (all knowledge neuron summaries)
- Output: structured bullet tree with initial completeness scores and links

**`research-neuron-scorer`** — re-scores completeness and discovers links:
- Input: existing bullet tree, all knowledge neuron content in the brain
- Output: updated completeness percentages and linked neuron IDs per bullet

**`research-bullet-expander`** — breaks a bullet into finer sub-points:
- Input: parent bullet context, existing children, brain context
- Output: new child bullets with scores

### Token Budget

Refresh scans the entire brain's knowledge content. For large brains:
- Use `contentText` (plain text) for all neurons
- Truncate per-neuron to first N characters for scoring pass
- Process in batches if total content exceeds context window
- Consider a two-pass approach: fast keyword matching to find candidate neurons, then LLM scoring on matches only
