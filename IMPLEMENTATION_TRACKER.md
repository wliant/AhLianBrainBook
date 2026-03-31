# Implementation Tracker

Tracks progress on items identified in [FEATURE_GAPS.md](./FEATURE_GAPS.md).

---

## Feature Gaps

| # | Item | Priority | Status | PR | Notes |
|---|------|----------|--------|-----|-------|
| 1 | Slash command menu | P0 | DONE | #3, #7 | `SlashCommand.tsx` via `@tiptap/suggestion`. 9 format commands + 7 section insertion commands. Shared `SuggestionDropdown` component with accessibility. |
| 2 | Bidirectional linking & backlinks | P0 | DONE | #3, #7 | `WikiLink.tsx` node extension with `[[` autocomplete. `syncEditorLinks()` auto-syncs to `neuron_links` table. `source` column (V14 migration) distinguishes manual vs editor links. Backlinks label in ConnectionsPanel. |
| 3 | Search highlighting & ranking | P0 | DONE | #3, #7 | `NeuronSearchRepository` with SQL-level filters, `ts_rank()`, `ts_headline()`. GIN index on title (V13). Debounced search-as-you-type. DOMPurify sanitization. |
| 4 | Spaced repetition | P1 | TODO | | |
| 5 | Keyboard-first workflow | P1 | TODO | | |
| 6 | Command palette | P1 | TODO | | |
| 7 | Vim editor mode | P1 | TODO | | |
| 8 | Code execution / REPL | P1 | TODO | | |
| 9 | Markdown & PDF export | P1 | TODO | | |
| 10 | Table of contents | P1 | TODO | | |
| 11 | Hierarchical tags | P2 | TODO | | |
| 12 | Cross-brain search | P2 | TODO | | |
| 13 | Read-only sharing | P2 | TODO | | |
| 14 | Plugin system | P2 | TODO | | |
| 15 | Git-backed versioning | P2 | TODO | | |
| 16 | OpenAPI docs | P2 | TODO | | |

## Performance Improvements

| # | Item | Priority | Status | PR | Notes |
|---|------|----------|--------|-----|-------|
| P-1 | Client-side caching (React Query) | P0 | TODO | | |
| P-2 | Server-side caching (Caffeine) | P0 | TODO | | |
| P-3 | List virtualization | P0 | TODO | | |
| P-4 | N+1 query in NeuronService.toResponse() | P1 | TODO | | `toResponse()` still queries tags per-neuron. `SearchService` N+1 was fixed (uses `getByIds()`), but list endpoints (`getByClusterId`, `getFavorites`, etc.) still have it. |
| P-4b | Search pagination broken | P1 | DONE | #3, #7 | Fixed as part of Feature #3. All filters now in SQL via `NeuronSearchRepository`. |
| P-4c | BrainStatsService in-memory aggregation | P1 | TODO | | |
| P-5 | SSE notifications | P1 | TODO | | |
| P-6 | HTTP caching headers | P1 | TODO | | |
| P-7 | Graph rendering at scale | P1 | TODO | | |
| P-8 | Monaco bundle size | P1 | TODO | | |
| P-9 | Connection pool tuning | P2 | TODO | | |
| P-10 | Image optimization | P2 | TODO | | |
| P-11 | Response compression (gzip) | P2 | TODO | | |
| P-12 | Editor instance reuse | P2 | TODO | | |

---

## Implementation Memos

### Flyway Migration Numbering
- V11 had a duplicate (`add_entity_metadata_and_settings` + `add_revision_title`). The revision title migration was renamed to **V12**. Next available migration number is **V15**.

### Duplicate V11 migration (V12 rename)
- Original `V11__add_revision_title.sql` was renamed to `V12__add_revision_title.sql` to resolve the Flyway conflict. If the database was already migrated with the old V11, Flyway will fail on startup because the checksum won't match. For existing deployments, either:
  - Run `DELETE FROM flyway_schema_history WHERE version = '11' AND description = 'add revision title'` before deploying, OR
  - Use `flyway.outOfOrder=true` temporarily

### NeuronSearchRepository Uses Native SQL
- `NeuronSearchRepository` builds dynamic native SQL via string concatenation. The user query is always bound via `:query` parameter (safe from injection), but the SQL template variables (`tsquery`, `tsvectorContent`, `tsvectorTitle`) are hardcoded strings — never user input. A comment in the code documents this. If modifying the query, keep all user input parameterized.

### WikiLink Sync Architecture
- Wiki links are synced on every `updateContent()` call in `NeuronService`. The sync:
  1. Parses `contentJson` for `wikiLink` nodes (recursive JSON traversal)
  2. Diffs against existing editor-created links (`source='editor'`)
  3. Creates new links / deletes stale ones
- Links created manually (via AddLinkDialog) have `source='manual'` and are **never** touched by the sync.
- The content JSON can be either TipTap format (`{"type":"doc","content":[...]}`) or sections format (`{"version":2,"sections":[...]}`). The recursive parser handles both.
- If JSON parsing fails, it logs an error and returns an empty set (no links synced, no links deleted). This is safe — next successful save will reconcile.

### Shared Suggestion Components
- `SuggestionDropdown.tsx` — generic dropdown with keyboard nav, accessibility (`role="listbox"`, `aria-selected`), accepts `renderItem`/`getKey` for customization.
- `suggestionRenderer.tsx` — `createSuggestionRenderer()` factory manages DOM container lifecycle (create/position/cleanup) with a `isCleanedUp` guard to prevent double-unmount.
- Both `SlashCommand` and `WikiLink` use these shared components. When adding new suggestion-based features, use the same pattern.

### Search Page XSS Protection
- Search highlights are rendered via `dangerouslySetInnerHTML`. The backend returns `<mark>` tags from PostgreSQL `ts_headline()`. The frontend sanitizes with **DOMPurify** restricted to `ALLOWED_TAGS: ["mark"]` only. Do not expand the allowed tags without security review.

### Backend Tests — Gradle Wrapper
- The `gradle-wrapper.jar` is missing from the repo (`.gitignore`'d or never committed). In the CI environment (GitHub Actions), the `gradle/actions/setup-gradle@v4` action handles this. Locally, the system `gradle` at `/opt/gradle/bin/gradle` can be used, but the sandbox environment's proxy blocks `plugins.gradle.org`, preventing dependency resolution. Backend tests pass in CI.

### SearchService N+1 Fix
- `SearchService` now uses `neuronService.getByIds(ids)` to batch-fetch neurons. However, `getByIds()` itself still calls `toResponse()` per neuron, which has the per-neuron tag fetch N+1 (P-4). Fully fixing this requires the batch tag fetch described in P-4.
