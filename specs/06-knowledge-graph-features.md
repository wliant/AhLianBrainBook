# Knowledge Graph Features Specification

Capabilities observed in the "Understand Anything" knowledge graph dashboard that BrainBook currently lacks, prioritized for implementation.

## Priority Legend

- **P0** -- Foundation / prerequisite for other features
- **P1** -- High value, moderate effort
- **P2** -- Enhanced experience, builds on P0/P1
- **P3** -- Nice-to-have

## Implementation Phases

- **Phase 1 (Foundation):** P0-1, P0-2, P0-3, P1-6, P1-7
- **Phase 2 (Links & Visualization):** P1-4, P1-5, P1-8, P2-11
- **Phase 3 (Polish):** P2-9, P2-10, P2-12, P2-13, P3-17
- **Phase 4 (Advanced):** P3-14, P3-15, P3-16

---

## P0-1: NeuronLink REST API

**Problem:** The `neuron_links` table exists in the database but there are no REST endpoints to create, read, or delete links. Links between neurons cannot be managed from the frontend.

**What the knowledge graph does:** Nodes are connected by directed edges (imports, calls, contains, tested_by) with visual arrows and labels.

**Scope:**
- `GET /api/neuron-links/neuron/{neuronId}` -- list all links for a neuron (both directions)
- `POST /api/neuron-links` -- create a link (sourceNeuronId, targetNeuronId, label, type, weight)
- `DELETE /api/neuron-links/{id}` -- remove a link
- `GET /api/neuron-links/brain/{brainId}` -- list all links within a brain (for graph visualization)

**Files to create:**
- `app/src/main/java/com/wliant/brainbook/controller/NeuronLinkController.java`
- `app/src/main/java/com/wliant/brainbook/service/NeuronLinkService.java`
- `app/src/main/java/com/wliant/brainbook/dto/NeuronLinkRequest.java`
- `app/src/main/java/com/wliant/brainbook/dto/NeuronLinkResponse.java`
- `web/src/lib/hooks/useNeuronLinks.ts`

**Files to modify:**
- `app/src/main/java/com/wliant/brainbook/repository/NeuronLinkRepository.java` -- add query methods
- `web/src/lib/api.ts` -- add neuronLinks API methods

**Effort:** Small (1-2 days). Follows the same controller/service/DTO pattern as every other entity.

---

## P0-2: NeuronLink Schema Enhancement

**Problem:** The `neuron_links` table only has `id`, `source_neuron_id`, `target_neuron_id`, `created_at`. The knowledge graph has labeled, typed, weighted edges.

**What the knowledge graph does:** Each edge has `type` (imports/calls/contains/tested_by), `label` (human-readable description), and `weight` (0-1 float).

**Scope:**
- New Flyway migration adding columns to `neuron_links`:
  - `label VARCHAR(255)` -- human-readable edge label (e.g., "calls login service")
  - `link_type VARCHAR(50)` -- edge category (e.g., "references", "depends-on", "related-to")
  - `weight DOUBLE PRECISION DEFAULT 1.0` -- connection strength

**Files to create:**
- `app/src/main/resources/db/migration/V*__add_neuron_link_metadata.sql`

**Files to modify:**
- `app/src/main/java/com/wliant/brainbook/model/NeuronLink.java` -- add fields
- DTOs from P0-1

**Effort:** XS (half day).

---

## P0-3: Import/Export

**Problem:** No way to programmatically import structured data into BrainBook or export a brain's contents. Migration from external tools requires manual entry or custom scripts.

**What the knowledge graph does:** Loads an entire project analysis from a single JSON file containing nodes, edges, layers, and tour data.

**Scope:**
- `POST /api/brains/import` -- accepts a JSON payload describing a brain with clusters, neurons, tags, and links. Creates everything in a single transaction.
- `GET /api/brains/{id}/export` -- returns the complete brain as JSON (clusters, neurons with content, tags, links).
- Support knowledge-graph JSON format as an import source (transform layers to clusters, nodes to neurons, edges to links).

**Files to create:**
- `app/src/main/java/com/wliant/brainbook/controller/ImportExportController.java`
- `app/src/main/java/com/wliant/brainbook/service/ImportExportService.java`
- `app/src/main/java/com/wliant/brainbook/dto/BrainExportDto.java`
- `app/src/main/java/com/wliant/brainbook/dto/BrainImportDto.java`

**Effort:** Medium (3-5 days).

---

## P1-4: NeuronLink UI

**Problem:** Even after P0-1 provides the API, there is no UI for users to create or view links between neurons.

**What the knowledge graph does:** Clicking a node shows a "Connections" panel listing all linked nodes with direction arrows and edge labels. Clicking a connection navigates to that node.

**Scope:**
- Connections panel on the neuron editor page showing:
  - Incoming links (neurons that link TO this neuron)
  - Outgoing links (neurons this neuron links TO)
  - Each link shows: target neuron title, link label, link type
  - Click to navigate to linked neuron
- "Add Link" button with autocomplete neuron search (search across all neurons in the brain)
- Optional label and type when creating a link
- Delete link button

**Files to create:**
- `web/src/components/neuron/ConnectionsPanel.tsx`
- `web/src/components/neuron/AddLinkDialog.tsx`

**Files to modify:**
- Neuron editor page to include the connections panel

**Effort:** Medium (2-3 days). Depends on P0-1.

---

## P1-5: Knowledge Graph Visualization

**Problem:** BrainBook has no visual representation of how neurons relate to each other. Users can only navigate linearly through the sidebar tree.

**What the knowledge graph does:** Interactive React Flow canvas showing nodes as cards and edges as arrows. Pan, zoom, minimap, fit-view. Nodes positioned by layer with force-directed layout within each layer. Edge labels visible on hover.

**Scope:**
- New route: `/brain/[brainId]/graph`
- React Flow canvas rendering all neurons in the brain as nodes, NeuronLinks as edges
- Nodes grouped by cluster (visual grouping)
- Click node to open detail panel (summary, tags, connections)
- Double-click node to navigate to neuron editor
- Edge labels shown on edges
- Zoom controls, fit-view button
- Link to graph view from brain page

**Files to create:**
- `web/src/app/brain/[brainId]/graph/page.tsx`
- `web/src/components/graph/GraphCanvas.tsx`
- `web/src/components/graph/NeuronNode.tsx` -- custom node component
- `web/src/components/graph/NodeDetailPanel.tsx`

**New dependency:** `@xyflow/react` (React Flow v12)

**Effort:** Large (5-8 days). Depends on P0-1.

---

## P1-6: Nested Cluster UI

**Problem:** The `clusters` table supports `parent_cluster_id` for hierarchical nesting, but the sidebar only renders a flat list of clusters per brain.

**What the knowledge graph does:** Layers contain sub-groups (e.g., Backend API layer contains Finance, Menu, Orders sub-groups). Clicking a layer drills into its contents.

**Scope:**
- Sidebar `ClusterItem` component renders child clusters recursively
- Indentation or collapsible tree UI for nested clusters
- "Create sub-cluster" option in cluster context menu
- Drag-and-drop to nest/unnest clusters (stretch goal)

**Files to modify:**
- `web/src/components/layout/Sidebar.tsx` -- make cluster rendering recursive

**Effort:** XS (1 day). Quick win -- data model already supports it.

---

## P1-7: Breadcrumb Navigation

**Problem:** When viewing a neuron deep in the hierarchy, there's no visual path showing where you are. Users rely on the sidebar tree or URL to understand location.

**What the knowledge graph does:** Breadcrumb trail: `Project > Layer Name > (Esc to go back)` with clickable links.

**Scope:**
- Breadcrumb bar on cluster and neuron pages: `Brain Name > Cluster Name > Neuron Title`
- Each segment is clickable, navigating to that level
- Shows parent cluster chain for nested clusters

**Files to create:**
- `web/src/components/layout/Breadcrumb.tsx`

**Files to modify:**
- Cluster page and neuron editor page layouts

**Effort:** XS (half day). Quick win.

---

## P1-8: Cross-references in Content

**Problem:** Neuron content cannot link to other neurons. Users must manually navigate via sidebar. The knowledge graph tour descriptions reference specific nodes by name.

**What the knowledge graph does:** Tour step descriptions mention file names that, when the tour is active, highlight and navigate to those nodes in the graph.

**Scope:**
- Custom TipTap node/mark for neuron references: `[[Neuron Title]]` syntax
- Autocomplete popup when typing `[[` to search neurons
- Renders as a styled link in view mode
- Clicking navigates to the referenced neuron
- Backend: `GET /api/neurons/search-by-title?q=...&brainId=...` for autocomplete

**Files to create:**
- `web/src/components/editor/NeuronLinkExtension.ts` -- TipTap extension
- `web/src/components/editor/NeuronLinkSuggestion.tsx` -- autocomplete popup

**Files to modify:**
- `web/src/components/editor/TiptapEditor.tsx` -- register extension

**Effort:** Medium (2-3 days).

---

## P2-9: Layered/Hierarchical Graph View

**Problem:** A flat graph of all neurons becomes unreadable at scale. The knowledge graph organizes nodes into visual layers.

**What the knowledge graph does:** Nodes grouped into layer boxes on the canvas. Edges between layers shown as portal connections with counts. Click a layer to drill into its contents.

**Scope:**
- Graph view groups neurons by cluster using React Flow group nodes
- Cluster groups are collapsible -- collapsed shows cluster as single node with connection count
- Drill-down: click cluster group to expand and show internal nodes
- Cross-cluster edges shown as connections between groups when collapsed

**Depends on:** P1-5 (graph visualization)

**Effort:** Medium (3-4 days).

---

## P2-10: Node Focus Mode

**Problem:** In a large graph, it's hard to see the connections for a specific neuron.

**What the knowledge graph does:** "Focus" button on a node highlights it and dims/hides all unrelated nodes, showing only direct connections.

**Scope:**
- "Focus" button on node detail panel in graph view
- Dims all nodes except the selected node and its directly connected neighbors
- Shows only edges involving the focused node
- Click background or press Escape to exit focus mode

**Depends on:** P1-5

**Effort:** Small (1-2 days).

---

## P2-11: Minimap

**Problem:** Large graphs are hard to navigate without a spatial overview.

**What the knowledge graph does:** Bottom-right minimap showing the full graph with a viewport rectangle.

**Scope:**
- Add React Flow's built-in `<MiniMap />` component to the graph view
- Color-code nodes by cluster

**Depends on:** P1-5

**Effort:** XS (half day). React Flow provides this out of the box.

---

## P2-12: Complexity Metadata

**Problem:** Neurons have no way to indicate complexity or difficulty level.

**What the knowledge graph does:** Each node has a complexity badge (simple/moderate/complex) with color coding.

**Scope:**
- Add `complexity VARCHAR(20)` column to `neurons` table (values: simple, moderate, complex, or null)
- Badge displayed on neuron cards in cluster view and graph view
- Editable via dropdown on neuron editor page
- New Flyway migration

**Effort:** Small (1 day).

---

## P2-13: Metrics/Stats Dashboard

**Problem:** No high-level statistics about a brain's contents.

**What the knowledge graph does:** Overview panel showing total nodes, edges, layers, types, languages, frameworks.

**Scope:**
- Stats section on brain page showing:
  - Total neurons, clusters, tags, links
  - Neurons by complexity distribution
  - Most-connected neurons (highest link count)
  - Recently edited neurons
- Backend: `GET /api/brains/{id}/stats` returning aggregated counts

**Files to create:**
- `web/src/components/brain/BrainStats.tsx`
- `app/src/main/java/com/wliant/brainbook/dto/BrainStatsResponse.java`

**Effort:** Medium (2-3 days).

---

## P3-14: Guided Tours

**Problem:** No way to create a curated, step-by-step walkthrough of a brain's content.

**What the knowledge graph does:** 12-step tour with title, description, and associated nodes per step. Tour player highlights nodes on the graph and shows description in a side panel. Previous/Next navigation.

**Scope:**
- New domain entity: `Tour` (id, brainId, title, description) and `TourStep` (id, tourId, order, title, body, neuronIds[])
- CRUD API for tours and steps
- Tour player UI: step counter, prev/next buttons, description panel
- In graph view: tour highlights the associated neurons at each step
- In non-graph view: tour shows step description with links to neurons

**New tables:** `tours`, `tour_steps`, `tour_step_neurons`

**Effort:** Large (5-7 days). New domain concept.

---

## P3-15: Semantic Search

**Problem:** BrainBook only supports PostgreSQL full-text search (keyword matching). The knowledge graph offers semantic search that understands meaning.

**What the knowledge graph does:** Toggle between "Fuzzy" and "Semantic" search modes. Semantic search finds conceptually related nodes even without exact keyword matches.

**Scope:**
- Embedding generation for neuron content (on create/update)
- Vector storage via `pgvector` PostgreSQL extension
- `GET /api/search/semantic?q=...&brainId=...` endpoint using cosine similarity
- Frontend toggle between full-text and semantic search on search page
- Embedding model: OpenAI text-embedding-3-small or local alternative

**Prerequisites:** pgvector extension installed in PostgreSQL

**Effort:** Large (5-8 days). Major infrastructure addition.

---

## P3-16: Diff/Change Overlay

**Problem:** Revision history exists but there's no visual comparison between versions.

**What the knowledge graph does:** "Diff" toggle (currently disabled) to overlay changes on the graph.

**Scope:**
- Side-by-side or inline diff view when comparing two revisions of a neuron
- Highlighted additions (green) and deletions (red)
- Accessible from the revision history panel
- Uses `contentText` for diffing with a library like `diff` or `jsdiff`

**Effort:** Medium (3-4 days).

---

## P3-17: Keyboard Shortcuts

**Problem:** No global keyboard shortcuts for common actions.

**What the knowledge graph does:** `Shift + ?` opens keyboard shortcuts help dialog. Shortcuts for navigation, search, zoom.

**Scope:**
- `Ctrl+K` / `Cmd+K` -- open search
- `Ctrl+N` / `Cmd+N` -- new neuron
- `Ctrl+Shift+N` -- new cluster
- `Escape` -- go back / close panel
- `?` -- show shortcuts help dialog
- Arrow keys -- navigate neuron list
- In graph view: `+`/`-` for zoom, `F` for fit-view

**Files to create:**
- `web/src/components/KeyboardShortcuts.tsx`
- `web/src/lib/hooks/useKeyboardShortcuts.ts`

**Effort:** Small (1-2 days).

---

## Summary Table

| # | Feature | Priority | Effort | Depends On |
|---|---------|----------|--------|------------|
| 1 | NeuronLink REST API | P0 | S | -- |
| 2 | NeuronLink Schema Enhancement | P0 | XS | -- |
| 3 | Import/Export | P0 | M | -- |
| 4 | NeuronLink UI | P1 | M | 1 |
| 5 | Knowledge Graph Visualization | P1 | L | 1 |
| 6 | Nested Cluster UI | P1 | XS | -- |
| 7 | Breadcrumb Navigation | P1 | XS | -- |
| 8 | Cross-references in Content | P1 | M | -- |
| 9 | Layered/Hierarchical Graph View | P2 | M | 5 |
| 10 | Node Focus Mode | P2 | S | 5 |
| 11 | Minimap | P2 | XS | 5 |
| 12 | Complexity Metadata | P2 | S | -- |
| 13 | Metrics/Stats Dashboard | P2 | M | -- |
| 14 | Guided Tours | P3 | L | -- |
| 15 | Semantic Search | P3 | L | -- |
| 16 | Diff/Change Overlay | P3 | M | -- |
| 17 | Keyboard Shortcuts | P3 | S | -- |
