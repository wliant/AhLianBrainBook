# BrainBook Feature Gap Specification

**Date:** 2026-04-02
**Testing scope:** Exploratory testing with 3 brains (DSA, System Design, Software Testing), 33 clusters, 165 neurons.

---

## 1. Bulk Content Import / Brain Templates

**Gap:** Creating a comprehensive brain requires manually creating each cluster and neuron one-by-one through the UI. There is no way to import a structured knowledge base from external sources (Markdown files, JSON, CSV, Obsidian vaults) or to start from a pre-built template.

**Business Value:** Users building a technical notebook want to rapidly bootstrap a brain with existing notes or community-contributed structures. Without this, the onboarding experience is tedious — a brain with 12 clusters and 60 neurons takes dozens of clicks to set up manually. This directly impacts user retention: users who can't quickly populate their notebook with useful content will abandon the tool.

**Proposed Capability:**
- Import brain from Markdown folder structure (folder = cluster, file = neuron)
- Import from JSON/CSV
- Pre-built brain templates (e.g., "Data Structures & Algorithms", "System Design Interview Prep")
- Obsidian/Notion import adapter

---

## 2. Neuron Title Not Displayed in Favorites and Dashboard

**Gap (Bug):** When a neuron is favorited, the Favorites page and Dashboard Favorites section display it as "Untitled" instead of showing the actual neuron title ("Dynamic Arrays vs Static Arrays"). The Knowledge Graph also shows "Untitled" for the same neuron.

**Business Value:** Favorites are a primary navigation shortcut for power users — the whole point is to quickly access important neurons. Showing "Untitled" defeats this purpose entirely, forcing users to click through to identify each note. This breaks the core value proposition of the favorites feature.

**Root Cause Hypothesis:** The neuron title may not be included in the favorites query response, or the frontend is reading a different field than expected.

---

## 3. Cluster Description and Metadata

**Gap:** Clusters have no description field, neuron count preview, or metadata. On the brain overview page, clusters appear as plain text links with no context about what they contain or how many neurons are inside.

**Business Value:** When a brain grows to 10+ clusters (as seen in all three test brains), users need visual differentiation and context to navigate efficiently. Without descriptions or counts, users must click into each cluster to understand its scope. This creates unnecessary friction in a knowledge management tool where fast navigation is critical.

**Proposed Capability:**
- Cluster description field (like the brain description)
- Neuron count badge on each cluster card
- Cluster icons/colors for visual differentiation
- Cluster card preview showing the first 2-3 neuron titles

---

## 4. Knowledge Graph Layout and Interactivity

**Gap:** The Knowledge Graph renders all nodes in a single horizontal line with no hierarchical structure, clustering, or visual grouping. At 60+ neurons, nodes are tiny and indistinguishable. There is no way to filter by cluster, search within the graph, or zoom to a specific area meaningfully.

**Business Value:** The knowledge graph is meant to be a differentiating feature that helps users see connections between concepts — this is the "brain" metaphor in action. In its current state, it provides no visual insight that a simple list doesn't already provide. Users expect a knowledge graph to reveal relationships and clusters visually, similar to tools like Obsidian's graph view or TheBrain. Without meaningful layout, this feature is decorative rather than functional.

**Proposed Capability:**
- Force-directed or hierarchical layout grouping neurons by cluster
- Cluster-colored nodes
- Click-to-zoom on cluster groups
- Filter by cluster, tag, or connection count
- Search highlighting within the graph
- Edge labels for link types

---

## 5. Cross-Brain Search and Global Navigation

**Gap:** Search only works within the context of "all neurons" but results show neurons without indicating which brain they belong to at a glance in the result list (the breadcrumb path helps but is small). There is no way to search across brain names, cluster names, or descriptions — only neuron titles and content.

**Business Value:** As the number of brains grows, users need to quickly locate information regardless of which brain it lives in. A technical notebook is only useful if retrieval is fast. Users with 5+ brains and hundreds of neurons will struggle to find specific concepts without comprehensive search that covers all entity types.

**Proposed Capability:**
- Search results grouped by brain with clear visual separation
- Search across brain names, cluster names, descriptions, and tags
- Search filters: by brain, by date range, by content type
- Quick-switch command palette (Ctrl+K) for navigating anywhere instantly

---

## 6. Trash and Archive Confusion

**Gap:** Archiving a neuron via the API (`POST /api/neurons/{id}/archive`) sets `isArchived: true` but the Trash page shows "Trash is empty". The Trash page appears to look for `isDeleted` neurons only. There is no visible "Archive" concept in the UI — users have no way to soft-hide neurons without permanently trashing them.

**Business Value:** Knowledge management requires a non-destructive way to declutter without losing information. Users studying for an interview might want to archive sections they've mastered while keeping them searchable. Without a clear archive vs. trash distinction, users either keep stale content cluttering their view or risk losing it in the trash.

**Proposed Capability:**
- Separate Archive section (distinct from Trash)
- Archive accessible from neuron context menu
- Archived neurons excluded from default views but searchable
- Clear visual states: Active > Archived > Trashed > Permanently Deleted

---

## 7. Batch Operations on Neurons

**Gap:** There is no way to select multiple neurons for bulk actions (tag, move, archive, delete, export). Every operation must be performed one neuron at a time.

**Business Value:** Users organizing a large brain (60+ neurons) need batch operations to efficiently manage content. Tagging 20 neurons related to "interview prep" one-by-one is prohibitively slow. This is a fundamental productivity feature for any content management tool — without it, organizational overhead grows linearly with content volume, discouraging users from creating comprehensive knowledge bases.

**Proposed Capability:**
- Multi-select checkboxes on neuron lists
- Bulk tag, move to cluster, archive, delete, export
- "Select all in cluster" shortcut

---

## 8. Neuron Content Templates

**Gap:** The neuron editor starts with a blank section every time. There are no content templates for common note patterns (e.g., "Algorithm Analysis" template with sections for Problem, Approach, Complexity, Code; "System Design" template with sections for Requirements, High-Level Design, Deep Dive, Trade-offs).

**Business Value:** Consistent note structure dramatically improves both the writing and review experience. Users creating 60 algorithm notes want each to follow the same format so they can quickly scan and compare. Templates reduce the cognitive overhead of "what should I write?" and ensure completeness. This is especially valuable for spaced repetition review — structured notes are easier to quiz on.

**Proposed Capability:**
- Pre-built templates for common patterns (Algorithm, System Design, Concept, Comparison, etc.)
- Custom user-defined templates
- Template selection when creating a new neuron
- Apply template to existing empty neurons

---

## 9. Neuron Linking and Relationship Management

**Gap:** While the data model supports links between neurons (the brain overview shows "0 Links"), there is no obvious UI for creating links between neurons. The `[[` wiki-link syntax is mentioned in the architecture but its discoverability is zero — no tooltip, no autocomplete preview, and no link management panel visible during testing.

**Business Value:** Cross-referencing is the core value of a "brain" over a flat notebook. A user studying "Dijkstra's Shortest Path" should easily link to "Graph Representations" and "Priority Queue" — these connections are what make the knowledge graph meaningful and enable serendipitous review. Without easy linking, the knowledge graph stays empty and the "brain" metaphor is hollow.

**Proposed Capability:**
- Autocomplete dropdown when typing `[[` showing matching neuron titles
- "Related neurons" suggestions (AI-powered or tag-based)
- Backlinks panel showing which neurons link to the current one
- Visual link creation from the knowledge graph (drag between nodes)

---

## 10. Dashboard Analytics and Progress Tracking

**Gap:** The Dashboard shows only Favorites and Recent neurons. There is no overview of total knowledge base size, study progress, review statistics, or brain health metrics across all brains.

**Business Value:** Users maintaining multiple brains (interview prep, work notes, learning journals) need a high-level view of their knowledge portfolio. Metrics like "80% of your DSA neurons have content" or "15 neurons due for review this week" drive engagement and help users prioritize their study time. Without this, the Dashboard is just a landing page rather than a command center.

**Proposed Capability:**
- Brain cards with cluster/neuron counts, last activity, completion percentage
- Study streak and review statistics
- "Neurons needing content" list (empty neurons)
- Weekly/monthly activity chart
- Progress toward user-defined goals

---

## 11. Sidebar Brain Expansion and Navigation

**Gap:** Clicking a brain in the sidebar navigates to the brain page but doesn't expand to show clusters inline. The expand/collapse arrow exists but only toggles the brain tree — there is no way to see a brain's cluster structure at a glance from the sidebar while on any page.

**Business Value:** Power users navigate between neurons across brains frequently. Having to click through Brain > Cluster > Neuron every time is 3 clicks minimum. An expandable sidebar tree (Brain > Clusters > Neurons) would enable single-click navigation to any neuron from anywhere, similar to VS Code's file explorer or Notion's sidebar.

**Proposed Capability:**
- Expandable brain tree in sidebar showing clusters
- Optional: show neurons under each cluster
- Drag-and-drop reordering of clusters and neurons in sidebar
- Current location highlighting in the tree

---

## 12. Export and Sharing Enhancements

**Gap:** The neuron editor has "Export" and "Share" buttons, but these work only at the individual neuron level. There is no way to export an entire brain or cluster as a structured document (PDF, Markdown collection, HTML).

**Business Value:** Users create comprehensive knowledge bases for a purpose — sharing with teammates, creating study guides, or backing up knowledge. A DSA brain with 12 clusters and 60 neurons is a valuable artifact that users want to export as a complete document, not 60 individual files. This is also critical for team collaboration and knowledge sharing.

**Proposed Capability:**
- Export entire brain as: Markdown folder, single PDF, HTML site
- Export cluster as a structured document
- Selective export (choose which clusters/neurons to include)
- Import previously exported brains (round-trip support, see Gap #1)

---

## Priority Recommendation

| Priority | Gap | Impact | Effort |
|----------|-----|--------|--------|
| P0 (Bug) | #2 - Favorites shows "Untitled" | High - Broken core feature | Low |
| P0 (Bug) | #6 - Trash/Archive confusion | High - Data management broken | Low-Med |
| P1 | #4 - Knowledge Graph layout | High - Flagship feature unusable | Medium |
| P1 | #9 - Neuron linking UX | High - Core value proposition | Medium |
| P1 | #1 - Bulk import/templates | High - Onboarding & retention | Medium |
| P2 | #3 - Cluster metadata | Medium - Navigation quality | Low |
| P2 | #7 - Batch operations | Medium - Power user productivity | Medium |
| P2 | #8 - Content templates | Medium - Content quality | Medium |
| P2 | #5 - Cross-brain search | Medium - Scalability | Medium |
| P3 | #10 - Dashboard analytics | Medium - Engagement | High |
| P3 | #11 - Sidebar tree navigation | Low-Med - Navigation convenience | Medium |
| P3 | #12 - Brain-level export | Medium - Sharing & backup | Medium |
