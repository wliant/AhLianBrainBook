# Future Intelligence Features

Intelligent features beyond the existing per-section AI Assist. These operate at cluster and brain scope, leveraging the full knowledge graph and content corpus.

## Current State

| Level     | Existing Features                                        | AI Features                        |
|-----------|----------------------------------------------------------|------------------------------------|
| Neuron    | Rich editor, sections, tags, links, revisions, complexity | AI Assist (per-section authoring)  |
| Cluster   | Neuron list with previews, breadcrumbs                   | None                               |
| Brain     | Stats, knowledge graph, description, tags, export        | None                               |

---

## Cluster-Level Features

### 1. Cluster Q&A

Ask natural-language questions about the content across all neurons in a cluster. The AI answers using neuron content as context and cites which neurons the answer came from.

**Motivation:** Users know the answer is "somewhere in this cluster" but don't want to open every neuron to find it. This turns a passive notebook into a queryable knowledge base.

**UX Concept:**
- Button or input field on the cluster page header (e.g., "Ask this cluster")
- Opens a chat panel anchored to the cluster page
- Each AI response includes inline citations linking to specific neurons
- Conversation is ephemeral (not persisted) — closing the panel resets it

**Data Flow:**
```
Cluster Page → chat input
    ↓
POST /api/clusters/{id}/ask
    ↓
[Backend] ClusterIntelligenceService
  - Fetch all neurons in cluster (id, title, contentText, tags)
  - Truncate/summarize if total token count exceeds budget
  - Build context payload
    ↓
POST /api/agents/cluster-qa
    ↓
[Intelligence] cluster_qa agent (LangGraph)
  - System prompt: "You are answering questions about a knowledge cluster. Here are the neurons..."
  - Include neuron titles + contentText as numbered references
  - Instruct model to cite [Neuron X] in answers
  - Return answer + cited neuron IDs
    ↓
Response with answer text + neuron references rendered as links
```

**Architectural Notes:**
- Token budget is the main constraint. A cluster with 50 neurons averaging 2000 chars each = ~100K chars. May need a two-pass approach: (1) retrieve relevant neurons via keyword/embedding match, (2) answer using top-K neurons only.
- The `contentText` field (plain-text extraction) is ideal for this — no need to parse `contentJson`.
- Could later evolve into full RAG with vector embeddings, but keyword-based retrieval is a viable MVP.

---

### 2. Gap Analysis

AI analyzes the cluster's neurons and identifies missing topics or areas that would logically complete the knowledge coverage.

**Motivation:** Turns passive note-taking into active knowledge building. The system tells you what you haven't covered yet, based on what you have covered.

**UX Concept:**
- Button on cluster page: "Analyze Gaps"
- Opens a results panel showing:
  - Summary of what the cluster currently covers
  - List of suggested missing topics, each with a brief explanation of why it's expected
  - "Create Neuron" button next to each suggestion to scaffold a new neuron with that topic

**Data Flow:**
```
Cluster Page → "Analyze Gaps" button
    ↓
POST /api/clusters/{id}/gap-analysis
    ↓
[Backend] Fetch cluster name, all neuron titles + contentText summaries, tags
    ↓
POST /api/agents/gap-analyzer
    ↓
[Intelligence] gap_analyzer agent
  - System prompt includes cluster name, brain name, neuron summaries
  - Asks: "Given these notes on [cluster topic], what important subtopics are missing?"
  - Returns structured JSON: { coverage_summary, gaps: [{ topic, rationale, suggested_title }] }
    ↓
Render results panel with actionable suggestions
```

**Architectural Notes:**
- Quality depends heavily on the LLM understanding the domain. Works best for well-known technical topics (e.g., "Spring Security" cluster) where the model has strong priors.
- For niche/personal topics, the model may suggest generic filler. Consider allowing the user to provide a "scope description" for the cluster to anchor the analysis.

---

### 3. Cluster Summary Generation

AI reads all neurons in a cluster and generates a concise overview — what the cluster covers, key concepts, and how neurons relate.

**Motivation:** When returning to a cluster after weeks, users need to re-orient quickly. A generated summary provides instant context without re-reading every neuron.

**UX Concept:**
- Button on cluster page: "Generate Summary"
- Summary displayed at the top of the cluster page (above the neuron list)
- Option to save as the cluster description, or dismiss
- Regenerate button if the summary isn't satisfactory

**Data Flow:**
```
POST /api/clusters/{id}/summarize
    ↓
[Backend] Fetch all neuron titles + contentText + tags
    ↓
POST /api/agents/cluster-summarizer
    ↓
[Intelligence] Generates structured summary:
  { summary, key_concepts: string[], neuron_relationships: string[] }
    ↓
Render summary card on cluster page
```

**Architectural Notes:**
- This is the simplest cluster-level feature to implement. Single LLM call, structured output.
- Could optionally persist the summary as a cluster `description` field (currently clusters have no description — would need a schema migration).
- Summary should include a "generated at" timestamp so the user knows if it's stale.

---

### 4. Organization Suggestions

AI suggests how to reorganize neurons within a cluster: reorder for logical flow, split into sub-clusters, merge overlapping neurons, or move neurons to a different cluster.

**Motivation:** Notebooks get messy over time. As a cluster grows, its organization drifts. This feature acts like an AI librarian suggesting a better shelf arrangement.

**UX Concept:**
- Button on cluster page: "Suggest Organization"
- Results panel with categorized suggestions:
  - **Reorder**: Suggested neuron sequence with rationale
  - **Split**: "These 5 neurons could form a sub-cluster called X"
  - **Merge**: "Neuron A and Neuron B cover similar ground"
  - **Move**: "Neuron C seems more related to cluster Y"
- Each suggestion has "Apply" / "Dismiss" buttons

**Data Flow:**
```
POST /api/clusters/{id}/organize
    ↓
[Backend] Fetch cluster neurons, sibling clusters in the same brain, neuron links
    ↓
POST /api/agents/cluster-organizer
    ↓
Returns: { reorder_suggestions, split_suggestions, merge_suggestions, move_suggestions }
```

**Architectural Notes:**
- Needs awareness of sibling clusters (to suggest moves), so the context payload is larger.
- "Apply" actions map to existing API endpoints (reorder, move, etc.).
- Results are inherently subjective — keep suggestions non-destructive and always require user confirmation.

---

### 5. Study Guide / Learning Path

AI orders the cluster's neurons into a suggested reading sequence and generates transition text between them, creating a guided learning experience.

**Motivation:** When reviewing a topic, users want a guided path through their notes rather than a flat unordered list. Especially valuable when combined with the existing spaced repetition feature.

**UX Concept:**
- Button on cluster page: "Generate Study Guide"
- Opens a dedicated view (similar to the Thought viewer) showing:
  - Ordered list of neurons with AI-generated transition text between each
  - Progress tracking (mark neurons as reviewed)
  - Estimated reading time per neuron
- Option to save as a Thought for future access

**Data Flow:**
```
POST /api/clusters/{id}/study-guide
    ↓
[Backend] Fetch all neurons with full contentText, tags, complexity, links
    ↓
POST /api/agents/study-guide-generator
    ↓
Returns: { 
  title, 
  introduction,
  steps: [{ neuron_id, transition_text, key_takeaways }],
  conclusion 
}
```

**Architectural Notes:**
- The ordering problem is non-trivial: depends on complexity, prerequisites (links with `depends-on` type), and conceptual flow.
- Existing `NeuronLink` data (especially `depends-on` and `references` types) provides strong ordering signals.
- Could integrate with spaced repetition: after generating the guide, auto-queue neurons in the suggested order.

---

## Brain-Level Features

### 6. Brain Health Report

AI analyzes the entire brain and produces a health report covering content freshness, connectivity, complexity balance, tag hygiene, and coverage.

**Motivation:** Brains grow organically over months/years. Without periodic review, they accumulate stale content, orphan neurons, and organizational debt. A health report surfaces these issues proactively.

**UX Concept:**
- Button on brain page (near existing stats section): "AI Health Report"
- Opens a report view with sections:
  - **Stale Content**: Neurons not updated in N months, ranked by staleness
  - **Orphan Neurons**: Neurons with zero incoming or outgoing links
  - **Complexity Imbalance**: Clusters that are disproportionately simple or complex
  - **Tag Hygiene**: Unused tags, duplicate/similar tags, untagged neurons
  - **Coverage Map**: Visual indicator of which areas are deep vs. shallow
- Each finding links to the relevant neuron/cluster for action

**Data Flow:**
```
POST /api/brains/{id}/health-report
    ↓
[Backend] Aggregate:
  - All neurons with lastEditedAt, tags, complexity, link counts
  - All clusters with neuron counts
  - All tags with usage counts
  - Brain stats (existing endpoint data)
    ↓
POST /api/agents/brain-health
    ↓
Returns structured report with categorized findings + severity levels
```

**Architectural Notes:**
- Much of this can be computed with SQL queries alone (stale content, orphans, tag usage). The AI adds value in synthesizing findings into prioritized recommendations and natural-language explanations.
- Consider a hybrid approach: backend computes metrics, AI interprets and prioritizes them.
- The existing `BrainStats` component already shows some of this data (neuron count, complexity breakdown, most connected). The health report extends this with AI interpretation.

---

### 7. Link Suggestion (Knowledge Graph Enhancement)

AI reads neuron content across the brain and suggests missing links between neurons that are semantically related but not yet connected.

**Motivation:** Manual linking is tedious. The wiki-link `[[` syntax catches explicit references, but many semantic connections go unlinked. This feature strengthens the knowledge graph automatically.

**UX Concept:**
- Button on brain page or knowledge graph page: "Suggest Links"
- Results panel showing suggested connections:
  - Source neuron → Target neuron
  - Suggested link type (references, depends-on, related-to, etc.)
  - Explanation of why the link is suggested (shared concepts, direct mentions, etc.)
  - "Accept" / "Reject" buttons per suggestion
- Batch accept option for high-confidence suggestions

**Data Flow:**
```
POST /api/brains/{id}/suggest-links
    ↓
[Backend] Fetch all neurons (id, title, contentText, existing links, tags)
    ↓
POST /api/agents/link-suggester
    ↓
[Intelligence] Two-phase approach:
  Phase 1: Keyword/TF-IDF overlap to identify candidate pairs (fast, no LLM)
  Phase 2: LLM evaluates top-K candidate pairs for meaningful relationships
    ↓
Returns: [{ source_id, target_id, link_type, confidence, explanation }]
```

**Architectural Notes:**
- Full pairwise comparison of N neurons is O(N^2) and infeasible for large brains. Must use a candidate generation step (keyword overlap, shared tags, TF-IDF similarity) to narrow down pairs before LLM evaluation.
- Existing link types (`related-to`, `references`, `depends-on`, `imports`, `calls`, `contains`, `tested-by`) provide a constrained vocabulary for suggestions.
- The "Accept" action maps directly to the existing `POST /api/neuron-links` endpoint.
- This integrates naturally with the knowledge graph visualization — suggested links could be shown as dashed lines in a preview mode.

---

### 8. Auto-Tagging

AI reads untagged or lightly-tagged neurons and suggests tags based on content analysis. Uses existing tags as a vocabulary and can suggest new ones.

**Motivation:** Tags are the foundation of Thoughts (filtered collections) and search. Most users under-tag their notes. Auto-tagging lowers the friction of maintaining good metadata.

**UX Concept:**
- Button on brain page: "Auto-Tag Neurons"
- Results panel:
  - List of neurons with suggested tags (existing tags in blue, new tag suggestions in green)
  - Per-neuron accept/reject for each tag
  - Bulk accept for high-confidence suggestions
  - Option to create suggested new tags before applying

**Data Flow:**
```
POST /api/brains/{id}/auto-tag
    ↓
[Backend] Fetch:
  - All neurons (id, title, contentText, current tags)
  - All existing tags (id, name) as vocabulary
    ↓
POST /api/agents/auto-tagger
    ↓
[Intelligence] For each under-tagged neuron:
  - Extract key topics from title + contentText
  - Match against existing tag vocabulary
  - Suggest new tags only when no existing tag fits
    ↓
Returns: [{ neuron_id, suggested_tags: [{ tag_name, is_new, confidence }] }]
```

**Architectural Notes:**
- Should strongly prefer existing tags over creating new ones to prevent tag sprawl.
- Could be run incrementally: only process neurons updated since the last auto-tag run.
- Tag suggestions could also surface at the neuron level (inline suggestion when editing) as a lighter-weight alternative.

---

### 9. Duplicate / Overlap Detection

AI identifies neurons with substantially similar content across different clusters. Suggests merging or linking them.

**Motivation:** Over time, users write about the same concept in different contexts without realizing it. Duplicates fragment knowledge and lead to inconsistencies.

**UX Concept:**
- Button on brain page: "Find Duplicates"
- Results panel showing groups of overlapping neurons:
  - Side-by-side preview of each pair
  - Overlap percentage or similarity score
  - Actions: "Link these", "Merge into one", "Dismiss"

**Data Flow:**
```
POST /api/brains/{id}/find-duplicates
    ↓
[Backend] Fetch all neurons (id, title, contentText, clusterId)
    ↓
POST /api/agents/duplicate-detector
    ↓
[Intelligence] Two-phase:
  Phase 1: TF-IDF or embedding similarity to find candidate pairs
  Phase 2: LLM confirms and explains overlap
    ↓
Returns: [{ neurons: [id, id], similarity, overlap_description, suggested_action }]
```

**Architectural Notes:**
- Similar candidate generation challenge as Link Suggestion. Use text similarity metrics to narrow candidates before LLM evaluation.
- "Merge" is a complex operation: needs to combine sections from two neurons into one. This could be a follow-up AI task (using the existing section-author agent to rewrite merged content).
- Start with detection + linking as MVP. Merge can come later.

---

### 10. Cross-Cluster Insights

AI identifies themes and patterns that span multiple clusters and suggests creating Thoughts (tag-based collections) to surface them.

**Motivation:** Knowledge often cuts across organizational boundaries. A concept like "error handling" might appear in Java, Python, and Go clusters but never be connected. This feature auto-discovers cross-cutting concerns and bridges them using the existing Thoughts feature.

**UX Concept:**
- Button on brain page: "Discover Themes"
- Results panel showing discovered cross-cutting themes:
  - Theme name and description
  - Which clusters/neurons participate
  - "Create Thought" button that pre-fills a Thought with appropriate tags
  - "Dismiss" to ignore a theme

**Data Flow:**
```
POST /api/brains/{id}/discover-themes
    ↓
[Backend] Fetch all clusters, neurons (title, tags, contentText), existing thoughts
    ↓
POST /api/agents/theme-discoverer
    ↓
[Intelligence] 
  - Analyze content across clusters for recurring concepts
  - Filter out themes already captured by existing Thoughts
  - Return novel cross-cutting themes
    ↓
Returns: [{ 
  theme_name, 
  description, 
  clusters_involved: [id], 
  neurons_involved: [id],
  suggested_tags: [string],
  tag_mode: "any" | "all"
}]
```

**Architectural Notes:**
- Requires processing the entire brain content. For large brains, use a map-reduce approach: summarize each cluster first, then find cross-cluster patterns.
- The output directly feeds into the existing Thought creation API, making it highly actionable.
- Should exclude themes that are too broad (e.g., "programming") or too narrow (only 2 neurons).

---

## Prioritization

| Priority   | Feature               | Level   | Rationale                                                                 |
|------------|-----------------------|---------|---------------------------------------------------------------------------|
| **High**   | Cluster Q&A           | Cluster | Highest day-to-day utility. Straightforward RAG pattern. Clear UX.        |
| **High**   | Link Suggestion       | Brain   | Leverages existing knowledge graph. Accept/reject UX is simple.           |
| **High**   | Auto-Tagging          | Brain   | Low friction. Improves Thoughts and search as downstream effects.         |
| **Medium** | Gap Analysis          | Cluster | Very useful for active learners. Needs good topic understanding from LLM. |
| **Medium** | Brain Health Report   | Brain   | Great for maintenance. Partially computable without AI.                   |
| **Medium** | Cluster Summary       | Cluster | Simple to build. Nice quality-of-life improvement.                        |
| **Lower**  | Study Guide           | Cluster | Valuable but complex UX. Depends on good link data.                       |
| **Lower**  | Duplicate Detection   | Brain   | Useful at scale. Less critical for smaller brains.                        |
| **Lower**  | Cross-Cluster Insights| Brain   | Requires full-brain analysis. Higher latency.                             |
| **Lower**  | Organization Suggest. | Cluster | Subjective results. Harder to make actionable.                            |

## Shared Architectural Concerns

**Token Budget Management:**
Brain-level features must process many neurons. Strategies:
- Use `contentText` (plain text) rather than `contentJson` (structured TipTap) to minimize token usage
- Pre-truncate long neurons to first N characters for overview tasks
- Use two-phase approaches: fast candidate selection, then LLM evaluation on top-K
- For very large brains, consider map-reduce: summarize per-cluster, then analyze summaries

**New Intelligence Service Agents:**
Each feature maps to a LangGraph agent, following the existing `section-author` pattern. All agents should:
- Accept structured input with context
- Return structured JSON output
- Be stateless (full context in each request)
- Have mocked LLM tests

**Backend Proxy Pattern:**
Follow the existing `IntelligenceService.aiAssist()` pattern:
- Controller receives request
- Service enriches with database context (neuron content, tags, links, etc.)
- Transforms camelCase ↔ snake_case
- Forwards to intelligence service
- Returns structured response

**UX Patterns:**
- Cluster-level features: slide-out panel or inline results on the cluster page
- Brain-level features: dedicated results panel on the brain page (similar to BrainStats expansion)
- All suggestions should be non-destructive: accept/reject/dismiss per item
- Long-running operations should show progress indicators (these LLM calls may take 10-30 seconds)
