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
| 5 | Keyboard-first workflow | P1 | DONE | | 10 shortcuts: `Ctrl+\` sidebar toggle, `Ctrl+Shift+F` search, `Ctrl+S` save, `Ctrl+[/]` prev/next neuron, `Alt+1-9` switch brains. Uses `CustomEvent` for sidebar toggle, React Query cache for navigation. |
| 6 | Command palette | P1 | TODO | | |
| 7 | Vim editor mode | P1 | TODO | | |
| 8 | Code execution / REPL | P1 | TODO | | |
| 9 | Markdown & PDF export | P1 | DONE | | `MarkdownExportService` converts TipTap/sections JSON to Markdown. `ExportController` serves `/api/neurons/{id}/export/markdown` (text) and `/api/brains/{id}/export/markdown` (zip). Frontend export dropdown on neuron page. PDF via `window.print()` with `@media print` styles. |
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
| P-1 | Client-side caching (React Query) | P0 | DONE | | `@tanstack/react-query` with `QueryProvider` (staleTime 60s, gcTime 5min). Migrated 9 hooks: `useBrains`, `useClusters`, `useNeurons`, `useTags`, `useNeuronLinks`, `useNeuronHistory`, `useThoughts`, `useSettings`, `useNotifications`. Dashboard uses `useQuery` instead of raw `api.get`. |
| P-2 | Server-side caching (Caffeine) | P0 | DONE | | `spring-boot-starter-cache` + Caffeine. Caches: `brains` (5min), `tags` (5min), `settings` (10min), `brainStats` (2min), `clustersByBrain` (2min). `@Cacheable`/`@CacheEvict` on BrainService, TagService, SettingsService, BrainStatsService, ClusterService. |
| P-3 | List virtualization | P0 | DONE | | `@tanstack/react-virtual`. Sidebar neuron lists virtualized when >20 items. Search results virtualized when >30 items. Both use threshold-based fallback to plain rendering for small lists. |
| P-4 | N+1 query in NeuronService.toResponse() | P1 | DONE | | `TagRepository.findTagsWithNeuronIds()` batch query. `TagService.getTagsForNeurons()` returns `Map<UUID, List<TagResponse>>`. `NeuronService.toResponseBatch()` pre-fetches all tags in one query. Also fixed `BrainService.getAll()` with batch brain tag fetch via `TagService.getTagsForBrains()`. |
| P-4b | Search pagination broken | P1 | DONE | #3, #7 | Fixed as part of Feature #3. All filters now in SQL via `NeuronSearchRepository`. |
| P-4c | BrainStatsService in-memory aggregation | P1 | DONE | | Rewrote `getStats()` with 6 SQL aggregate queries (COUNT, GROUP BY, UNION ALL). No longer loads all neurons/links into memory. Uses EntityManager native queries. |
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
- `SearchService` now uses `neuronService.getByIds(ids)` to batch-fetch neurons. `getByIds()` now uses `toResponseBatch()` which batch-fetches tags in a single query — the N+1 is fully resolved.

### React Query Migration
- All data-fetching hooks migrated from `useState+useEffect+useCallback` to `@tanstack/react-query`. Hook return shapes preserved for backward compatibility — consumers don't need changes.
- `useNotifications` uses `refetchInterval` for polling (replaces manual `setInterval` + visibility API).
- Dashboard uses `useQuery` directly for recent/favorites/pinned neurons.
- Test wrapper `createWrapper.tsx` provides `QueryClientProvider` with `retry: false` for deterministic tests.
- Mutation functions use `queryClient.invalidateQueries()` rather than optimistic updates — simpler and correct.

### Caffeine Cache Configuration
- `CacheConfig.java` uses `CaffeineCacheManager` with per-cache TTLs via `registerCustomCache()`.
- Default cache: 5min TTL, max 500 entries. `settings`: 10min, max 1. `brainStats`/`clustersByBrain`: 2min.
- All `@CacheEvict` use `allEntries = true` for simplicity — acceptable given low cache sizes.

### Batch Tag Fetching
- `TagRepository.findTagsWithNeuronIds()` and `findTagsWithBrainIds()` return `List<Object[]>` from native queries joining `neuron_tags`/`brain_tags` with `tags`.
- `TagService.getTagsForNeurons()` and `getTagsForBrains()` convert to `Map<UUID, List<TagResponse>>`.
- `NeuronService.toResponseBatch()` and `BrainService.getAll()` use batch fetching. Single-neuron `toResponse()` delegates to `getTagsForNeurons()` with a single-element list.

### Markdown Export
- `MarkdownExportService` handles two content formats: TipTap (`{"type":"doc","content":[...]}`) and sections (`{"version":2,"sections":[...]}`).
- Section types handled: `richtext`, `code`, `math`, `diagram`, `callout`.
- TipTap node types handled: `heading`, `paragraph`, `bulletList`, `orderedList`, `blockquote`, `codeBlock`, `horizontalRule`.
- Inline marks: `bold` → `**`, `italic` → `_`, `code` → `` ` ``, `strike` → `~~`, `link` → `[text](href)`.
- Brain export produces a ZIP organized by cluster name. Filenames are sanitized.
