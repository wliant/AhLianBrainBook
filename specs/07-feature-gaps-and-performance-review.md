# Feature Gaps & Performance Review

## Overview

This document identifies feature gaps and performance improvements for BrainBook, targeting **highly technical, learning-motivated users** -- the kind of person who uses Obsidian, Logseq, or Notion for structured knowledge management.

Current stack: Spring Boot 3.5.13 (Java 21), Next.js 16 (React 19), PostgreSQL 16, MinIO.

---

## Part 1: Feature Gaps for Technical Learners

### P0 -- Critical Missing Features

#### 1. Slash Command Menu

The editor placeholder says "Use / for commands" but no slash command menu exists. Technical users expect a `/` menu to quickly insert content blocks.

**Current state:** `web/src/components/editor/TiptapEditor.tsx` uses TipTap with Placeholder extension showing the hint, but no Suggestion extension is configured.

**Recommendation:**
- Add TipTap `Suggestion` extension with a `/` trigger
- Menu items: code block, math block, diagram (Mermaid), callout, divider, image, table, audio
- Add markdown input rules for common patterns (`# ` for headings, `` ``` `` for code blocks, `- [ ]` for checklists)

#### 2. Bidirectional Linking & Backlinks

NeuronLinks exist in the backend (`NeuronLinkController`, `NeuronLink` model with source/target/label/type/weight) but there is no way to create links from within the editor. No `[[neuron title]]` syntax. No backlinks panel.

**Current state:**
- Backend: Full CRUD for neuron links at `/api/neuron-links`
- Frontend: `ConnectionsPanel.tsx` shows links but requires manual creation via dialog
- No inline linking from editor content

**Recommendation:**
- Add `[[` autocomplete in TipTap that searches neurons by title and inserts an internal link (`/brain/{brainId}/cluster/{clusterId}/neuron/{neuronId}`)
- Auto-create a `NeuronLink` when a `[[]]` link is inserted
- Add a "Backlinks" section to the neuron page showing all neurons that link to the current one
- Add a search endpoint: `GET /api/neurons/search?title=query` for fast title autocomplete

#### 3. Search with Highlighting & Relevance Ranking

Search returns results but doesn't highlight matched terms or show relevance ranking. No search-as-you-type.

**Current state:**
- Backend: `SearchService` uses PostgreSQL `to_tsvector`/`plainto_tsquery` with a GIN index
- Frontend: `search/page.tsx` shows results with a 150-char preview, no highlighting
- No debounced input -- search requires explicit submission

**Recommendation:**
- Backend: Return `ts_headline('english', content_text, query)` for highlighted snippets with `<mark>` tags
- Backend: Order results by `ts_rank(to_tsvector('english', content_text), query)` descending
- Frontend: Render highlighted HTML snippets (sanitized)
- Frontend: Add debounced search-as-you-type (300ms debounce)

---

### P1 -- High Value Features

#### 4. Spaced Repetition / Review System

Reminders exist (one-time and recurring DAILY/WEEKLY/MONTHLY) but there is no spaced repetition algorithm. A technical learner wants to flag concepts for review and have them resurface at increasing intervals.

**Recommendation:**
- Extend the `Reminder` model to support spaced repetition (SM-2 algorithm): add `easeFactor`, `interval`, `repetitions` fields
- Add a "Review Queue" page (`/review`) that surfaces neurons due for review
- Allow marking review quality (0-5 scale) which adjusts the next interval
- Track review history per neuron

#### 5. Keyboard-First Workflow

Only 4 keyboard shortcuts exist (`Ctrl+K` search, `Ctrl+N` new neuron, `Escape`, `?` help). Technical users need many more.

**Current state:** `web/src/components/KeyboardShortcuts.tsx` handles global shortcuts. TipTap handles editor formatting shortcuts internally (`Ctrl+B/I/U` etc.).

**Recommendation:**
- `Ctrl+\` -- Toggle sidebar
- `Ctrl+Shift+N` -- New cluster
- `Ctrl+[` / `Ctrl+]` -- Previous/next neuron in cluster
- `Ctrl+Shift+P` -- Command palette
- `Ctrl+S` -- Force save / create snapshot
- `Ctrl+Shift+F` -- Global search (cross-brain)
- `Ctrl+G` -- Open knowledge graph
- `Alt+1-9` -- Switch between brains

#### 6. Command Palette

No command palette exists. Technical users expect a way to fuzzy-search over all actions.

**Recommendation:**
- Build a `CommandPalette` component triggered by `Ctrl+Shift+P` or `Ctrl+K` (reclaim from simple search redirect)
- Index: all pages, all brains/clusters/neurons (by title), actions (create, toggle theme, open graph, export)
- Use fuzzy matching (e.g., `fuse.js` or `cmdk` library)
- Show recent items at the top

#### 7. Vim / Keyboard-Driven Editor Mode

No Vim keybindings option.

**Recommendation:**
- Gate behind a setting in `AppSettings` (`editorMode: "normal" | "vim"`)
- Use a ProseMirror Vim keymap plugin or TipTap extension
- Persist preference in backend settings

#### 8. Code Execution / REPL

Code sections (Monaco editor, 28 languages) are view-only -- code cannot be executed.

**Recommendation (MVP):**
- Add a "Run" button for JavaScript code sections using `eval()` in a sandboxed iframe
- For Python, integrate Pyodide (WebAssembly CPython) for client-side execution
- Display output below the code section
- Long-term: support more languages via server-side sandboxed execution

#### 9. Export to Markdown & PDF

Export only produces JSON (`ImportExportService`). No Markdown or PDF export.

**Recommendation:**
- Backend: Add `/api/neurons/{id}/export/markdown` endpoint that converts JSONB sections to Markdown
- Backend: Add `/api/brains/{id}/export/markdown` for full brain export as a zip of .md files
- Frontend: Add "Export as PDF" button using browser `window.print()` with a print-friendly stylesheet, or `html2pdf.js` for offline PDF

#### 10. Table of Contents / Outline View

Long neurons with deep heading hierarchies have no navigation aid.

**Recommendation:**
- Parse heading nodes from the neuron's section content
- Render a sticky sidebar outline (right side) with click-to-scroll
- Highlight the current section based on scroll position (Intersection Observer)

---

### P2 -- Nice to Have

#### 11. Hierarchical / Namespaced Tags
Tags are flat strings. Technical users benefit from hierarchy (e.g., `lang/rust`, `concept/data-structures/trees`). Allow `/` as a separator and render as a tree in the tag browser.

#### 12. Cross-Brain Global Search
Search currently requires brain/cluster scoping. Add a default mode that searches across all brains.

#### 13. Read-Only Sharing
No authentication exists. Even a simple signed-URL based read-only share link for individual neurons would enable knowledge sharing.

#### 14. Plugin / Extension System
No extensibility. Consider a plugin API that allows custom section types, custom slash commands, or custom graph layouts.

#### 15. Git-Backed Version Control
Revisions are database-stored snapshots. Technical users trust git. Consider an optional git backend for neuron content, enabling diff views and branch-based editing.

#### 16. OpenAPI Documentation
No API docs. Add `springdoc-openapi-starter-webmvc-ui` to `app/build.gradle.kts` for auto-generated Swagger UI at `/swagger-ui.html`. Technical users may want to script interactions.

---

## Part 2: Performance Improvements

### P0 -- Critical

#### 1. No Client-Side Data Caching

Every page navigation re-fetches all data from the backend. All custom hooks in `web/src/lib/hooks/` use raw `useEffect` + `useState` with no caching layer.

**Impact:** Sluggish navigation, unnecessary network requests, UI flicker on page transitions, redundant API calls when switching between neuron pages.

**Recommendation:**
- Replace all data-fetching hooks with **TanStack Query (React Query)** or **SWR**
- Benefits: stale-while-revalidate caching, request deduplication, background refetching, optimistic updates, automatic retry
- Affected hooks: `useBrains`, `useClusters`, `useNeurons`, `useTags`, `useThoughts`, `useNeuronLinks`, `useNeuronHistory`, `useSettings`, `useNotifications`

#### 2. No Server-Side Caching

No `@Cacheable` annotations in any service class. Frequently accessed, rarely mutated data is queried from PostgreSQL on every request.

**Recommendation:**
- Add Spring Cache abstraction with **Caffeine** as the provider
- Cache candidates:
  - `BrainService.getAll()` -- changes rarely, read on every sidebar render
  - `TagService.getAll()` -- changes rarely, read on every tag combobox
  - `SettingsService.getSettings()` -- almost never changes
  - `BrainStatsService.getStats(brainId)` -- expensive aggregation query
- Evict caches on create/update/delete mutations
- Add `spring-boot-starter-cache` and `com.github.ben-manes.caffeine:caffeine` dependencies

#### 3. No List Virtualization

All lists render every item in the DOM. Neuron lists, sidebar brain/cluster tree, search results, and revision lists have no virtualization.

**Impact:** A brain with 200+ neurons in a cluster will render all 200+ DOM nodes, degrading scroll performance and increasing memory usage.

**Recommendation:**
- Add `@tanstack/react-virtual` for lists that can exceed 50 items
- Key targets: neuron list in cluster page, sidebar tree, search results, notification list

---

### P1 -- Important

#### 4. N+1 Query in `NeuronService.toResponse()`

Every call to `toResponse(Neuron)` in `NeuronService` (line ~255) calls `tagService.getTagsForNeuron(neuron.getId())`, executing a separate DB query per neuron. List endpoints like `getByClusterId`, `getRecent`, `getFavorites`, `getTrash`, and `search` all trigger this -- a cluster with 50 neurons causes 51 queries. The same pattern exists in `ImportExportService.exportBrain()` (line ~74).

**Recommendation:**
- Add a repository method `findTagsByNeuronIdIn(Collection<UUID> neuronIds)` for batch fetching
- Replace per-neuron tag loading with a single `WHERE neuron_id IN (...)` query, then map in Java
- Audit `ThoughtService.resolveNeurons()` for the same pattern

#### 4b. Search Pagination is Broken

`SearchService` (lines ~37-47) fetches a page from the DB, then applies brain/cluster/tag filters **in Java**. This means: (a) results may be fewer than the requested page size, (b) `totalElements` count is wrong, (c) if most results are filtered out, the user sees empty pages even when matches exist.

**Recommendation:**
- Push all filters into the SQL query as WHERE clauses with optional joins on `neuron_tags` and `brain_tags`
- Add `ts_rank` for relevance ordering and `ts_headline` for highlighted snippets in the same query

#### 4c. BrainStatsService Loads All Neurons into Memory

`BrainStatsService.getStats()` (line ~36) loads ALL neurons and ALL links for a brain into memory, then computes counts, complexity breakdown, and top-5 lists in Java.

**Recommendation:**
- Replace with aggregate SQL queries: `SELECT COUNT(*)`, `GROUP BY complexity`, `ORDER BY COUNT DESC LIMIT 5`
- Use SQL `LIMIT 5` for recently-edited neurons instead of fetching all and streaming

#### 5. Notification Polling Overhead

`useNotifications` hook polls every 30 seconds via HTTP GET. For a single-user app this is wasteful.

**Recommendation:**
- Option A: Replace with **Server-Sent Events (SSE)** -- backend pushes notifications in real-time, eliminating polling entirely. Spring Boot supports SSE via `SseEmitter`.
- Option B: Increase poll interval to 120s and add immediate fetch on user-triggered actions (create reminder, navigate to notifications page).

#### 6. No HTTP Caching Headers

The backend sends no `Cache-Control`, `ETag`, or `Last-Modified` headers. The browser cannot cache any API response.

**Recommendation:**
- Add a Spring `WebMvcConfigurer` or filter that sets `Cache-Control: max-age=60, stale-while-revalidate=300` for GET endpoints on brains, tags, templates, settings
- For neuron content: use the `version` field as an `ETag` value, enabling conditional requests (`If-None-Match`) that return `304 Not Modified`

#### 7. Knowledge Graph Rendering at Scale

`GraphCanvas.tsx` loads ALL neurons and ALL links for an entire brain at once. Dagre layout computation is O(V + E).

**Impact:** A brain with 500+ neurons and 1000+ links will freeze the UI during layout computation and overwhelm the SVG renderer. Additionally, the `useMemo` dependencies include `focusedNode`, so changing focus re-runs the entire dagre layout (`applyClusteredLayout`) even though focus is a visual property, not a layout change.

**Recommendation:**
- Separate layout computation from focus/dimming state -- only recalculate layout when node/edge data changes, not on focus toggle
- Show cluster-level overview by default (one node per cluster, edges = inter-cluster links)
- Click to expand a cluster and show its neurons
- For 1000+ nodes, switch to a WebGL renderer (e.g., `sigma.js` or `@xyflow/react` with a canvas renderer)
- Add server-side pagination: `GET /api/neuron-links/brain/{id}?page=0&size=200`

#### 8. Monaco Editor Bundle Size

Monaco Editor is ~2MB+ gzipped. It's lazy-loaded per code section but the bundle is still large.

**Recommendation:**
- Evaluate **CodeMirror 6** as a lighter alternative (~200KB gzipped) with excellent language support
- If keeping Monaco: ensure web workers are properly configured and shared across multiple CodeSection instances. Use `monaco-editor-webpack-plugin` (or Vite equivalent) to tree-shake unused languages.

---

### P2 -- Minor

#### 9. Connection Pool Configuration
Using default HikariCP settings (10 max connections). Add explicit config in `application.yml`:
```yaml
spring.datasource.hikari:
  maximum-pool-size: 10
  minimum-idle: 2
  connection-timeout: 30000
  idle-timeout: 600000
```

#### 10. Image Optimization
Uploaded images are served as-is (original resolution, original format). No thumbnails, no WebP conversion, no `loading="lazy"` on image elements in the editor.

**Recommendation:**
- Add `loading="lazy"` to TipTap Image extension HTML attributes
- Generate thumbnails on upload (server-side) for list previews
- Consider on-the-fly WebP conversion via an image proxy

#### 11. No Response Compression
No gzip/brotli compression configured. JSONB neuron content can be large, especially with rich sections and code blocks.

**Recommendation:**
- Add `server.compression.enabled: true` to `application.yml`
- Configure mime types: `application/json`, `text/html`, `text/plain`
- Set minimum response size: `server.compression.min-response-size: 1024`

#### 12. TipTap Editor Re-initialization
The TipTap editor is fully re-created (all extensions re-initialized) on every neuron navigation instead of reusing the instance.

**Recommendation:**
- Lift the editor instance to a parent component or context
- Use `editor.commands.setContent(newContent)` when navigating between neurons
- Reduces initialization overhead and provides smoother transitions

---

## Summary Matrix

| # | Item | Type | Priority | Effort |
|---|------|------|----------|--------|
| 1 | Slash command menu | Feature | P0 | Medium |
| 2 | Bidirectional linking & backlinks | Feature | P0 | Large |
| 3 | Search highlighting & ranking | Feature | P0 | Medium |
| 4 | Spaced repetition | Feature | P1 | Large |
| 5 | Keyboard-first workflow | Feature | P1 | Medium |
| 6 | Command palette | Feature | P1 | Medium |
| 7 | Vim editor mode | Feature | P1 | Small |
| 8 | Code execution / REPL | Feature | P1 | Large |
| 9 | Markdown & PDF export | Feature | P1 | Medium |
| 10 | Table of contents | Feature | P1 | Small |
| 11 | Hierarchical tags | Feature | P2 | Medium |
| 12 | Cross-brain search | Feature | P2 | Small |
| 13 | Read-only sharing | Feature | P2 | Large |
| 14 | Plugin system | Feature | P2 | XL |
| 15 | Git-backed versioning | Feature | P2 | XL |
| 16 | OpenAPI docs | Feature | P2 | Small |
| P-1 | Client-side caching (React Query) | Performance | P0 | Medium |
| P-2 | Server-side caching (Caffeine) | Performance | P0 | Medium |
| P-3 | List virtualization | Performance | P0 | Medium |
| P-4 | N+1 query in NeuronService.toResponse() | Performance | P1 | Medium |
| P-4b | Search pagination broken (Java-side filtering) | Performance | P1 | Medium |
| P-4c | BrainStatsService loads all neurons into memory | Performance | P1 | Small |
| P-5 | SSE notifications | Performance | P1 | Medium |
| P-6 | HTTP caching headers | Performance | P1 | Small |
| P-7 | Graph rendering at scale + layout on focus | Performance | P1 | Large |
| P-8 | Monaco bundle size | Performance | P1 | Medium |
| P-9 | Connection pool tuning | Performance | P2 | Small |
| P-10 | Image optimization | Performance | P2 | Medium |
| P-11 | Response compression (gzip) | Performance | P2 | Small |
| P-12 | Editor instance reuse | Performance | P2 | Small |
