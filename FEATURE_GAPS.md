# Feature Gaps & Performance Review

## Overview

This document identifies feature gaps and performance improvements for BrainBook, targeting **highly technical, learning-motivated users** -- the kind of person who uses Obsidian, Logseq, or Notion for structured knowledge management.

Current stack: Spring Boot 3.5.13 (Java 21), Next.js 16 (React 19), PostgreSQL 16, MinIO.

See [IMPLEMENTATION_TRACKER.md](./IMPLEMENTATION_TRACKER.md) for implementation status.

---

## Part 1: Feature Gaps for Technical Learners

### P0 -- Critical

#### 1. Slash Command Menu
The editor placeholder says "Use / for commands" but no slash command menu exists. Technical users expect a `/` menu to quickly insert content blocks (code, math, diagram, callout, etc.) and trigger formatting (headings, lists, blockquote).

#### 2. Bidirectional Linking & Backlinks
NeuronLinks exist in the backend but there is no way to create links from within the editor. No `[[neuron title]]` syntax. No backlinks panel showing "neurons that link to this one."

#### 3. Search with Highlighting & Relevance Ranking
Search returns results but doesn't highlight matched terms or show relevance ranking. No search-as-you-type. Filters (brain, cluster, tags) were applied in Java after DB pagination, breaking page totals.

---

### P1 -- High Value

#### 4. Spaced Repetition / Review System
Reminders exist (one-time and recurring DAILY/WEEKLY/MONTHLY) but there is no spaced repetition algorithm. A technical learner wants to flag concepts for review and have them resurface at increasing intervals.

**Recommendation:**
- Extend the `Reminder` model to support spaced repetition (SM-2 algorithm): add `easeFactor`, `interval`, `repetitions` fields
- Add a "Review Queue" page (`/review`) that surfaces neurons due for review
- Allow marking review quality (0-5 scale) which adjusts the next interval
- Track review history per neuron

#### 5. Keyboard-First Workflow
Only 4 keyboard shortcuts exist (`Ctrl+K` search, `Ctrl+N` new neuron, `Escape`, `?` help). Technical users need many more.

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

#### P-1. No Client-Side Data Caching
Every page navigation re-fetches all data from the backend. All custom hooks in `web/src/lib/hooks/` use raw `useEffect` + `useState` with no caching layer.

**Impact:** Sluggish navigation, unnecessary network requests, UI flicker on page transitions.

**Recommendation:**
- Replace all data-fetching hooks with **TanStack Query (React Query)** or **SWR**
- Affected hooks: `useBrains`, `useClusters`, `useNeurons`, `useTags`, `useThoughts`, `useNeuronLinks`, `useNeuronHistory`, `useSettings`, `useNotifications`

#### P-2. No Server-Side Caching
No `@Cacheable` annotations in any service class. Frequently accessed, rarely mutated data is queried from PostgreSQL on every request.

**Recommendation:**
- Add Spring Cache with **Caffeine** for: `BrainService.getAll()`, `TagService.getAll()`, `SettingsService.getSettings()`, `BrainStatsService.getStats(brainId)`
- Evict caches on create/update/delete mutations

#### P-3. No List Virtualization
All lists render every item in the DOM. A brain with 200+ neurons degrades scroll performance.

**Recommendation:**
- Add `@tanstack/react-virtual` for neuron list, sidebar tree, search results, notification list

---

### P1 -- Important

#### P-4. N+1 Query in `NeuronService.toResponse()`
Every `toResponse()` call queries tags per-neuron. A cluster with 50 neurons causes 51 queries.

**Recommendation:**
- Add `findTagsByNeuronIdIn(Collection<UUID>)` for batch fetching
- Audit `ImportExportService` and `ThoughtService` for the same pattern

#### P-4b. Search Pagination Broken
`SearchService` applied filters in Java after DB pagination, causing wrong page sizes and totals.

#### P-4c. BrainStatsService Loads All Neurons into Memory
`BrainStatsService.getStats()` loads ALL neurons and links, computes stats in Java.

**Recommendation:** Replace with aggregate SQL queries (`COUNT`, `GROUP BY`, `LIMIT 5`)

#### P-5. Notification Polling Overhead
`useNotifications` polls every 30s. Wasteful for single-user.

**Recommendation:** Replace with SSE (`SseEmitter`) or increase interval to 120s.

#### P-6. No HTTP Caching Headers
No `Cache-Control`, `ETag`, or `Last-Modified` headers. Browser cannot cache API responses.

**Recommendation:** Set `Cache-Control: max-age=60` for brains/tags/settings. Use neuron `version` as `ETag`.

#### P-7. Knowledge Graph Rendering at Scale
`GraphCanvas.tsx` loads all neurons/links at once. Dagre layout re-runs on focus change.

**Recommendation:** Separate layout from visual state. Add cluster-level overview. Use WebGL for 1000+ nodes.

#### P-8. Monaco Editor Bundle Size
~2MB+ gzipped. Lazy-loaded but still large.

**Recommendation:** Evaluate CodeMirror 6 (~200KB) or tree-shake unused Monaco languages.

---

### P2 -- Minor

#### P-9. Connection Pool Configuration
Default HikariCP settings. Add explicit `maximum-pool-size`, `minimum-idle`, `connection-timeout` in `application.yml`.

#### P-10. Image Optimization
Images served as-is. No thumbnails, WebP conversion, or `loading="lazy"`.

#### P-11. No Response Compression
No gzip/brotli. Add `server.compression.enabled: true` to `application.yml`.

#### P-12. TipTap Editor Re-initialization
Editor re-created on every neuron navigation. Use `editor.commands.setContent()` instead.
