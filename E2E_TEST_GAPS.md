# Testing Gap Analysis

Comprehensive review of all three test layers: E2E (Playwright/pytest), Backend (JUnit 5/TestContainers), and Frontend (Vitest/RTL/MSW).

**Test execution results (this session):**
- Frontend: 10 files, 43 tests — all passing (6.06s)
- Backend: Could not run — requires Docker (TestContainers) and Gradle wrapper
- E2E: Could not run — requires full Docker stack (docker compose)

---

## 1. Missing Critical Path Testing

### 1.1 Backend — Entire Features Untested

Four domain features have **zero** test coverage (no service test, no controller test):

| Feature | Service | Controller | Repository |
|---------|---------|------------|------------|
| Notifications | `NotificationService` — untested | `NotificationController` — untested | `NotificationRepository` — untested |
| Reminders | `ReminderService`, `ReminderProcessingService`, `ReminderSchedulerService` — untested | (part of NotificationController) | `ReminderRepository` — untested |
| Settings | `SettingsService` — untested | `SettingsController` — untested | `AppSettingsRepository` — untested |
| Thoughts | `ThoughtService` — untested | `ThoughtController` — untested | `ThoughtRepository` — untested |

### 1.2 Backend — Missing Controller Integration Tests

These services have unit tests but no HTTP-level integration tests verifying request routing, serialization, status codes, and error responses:

- **AttachmentController** — file upload/download over HTTP not tested
- **BrainStatsController** — stats endpoint not tested
- **ImportExportController** — export/import endpoints not tested
- **SearchController** — search endpoint not tested
- **NotificationController** — completely untested
- **SettingsController** — completely untested
- **ThoughtController** — completely untested

### 1.3 Frontend — Severe Page Coverage Gap

**11 of 12 pages are untested** (92% uncovered):

- `brain/[brainId]/page.tsx` — Brain detail page
- `brain/[brainId]/cluster/[clusterId]/page.tsx` — Cluster detail page
- `brain/[brainId]/cluster/[clusterId]/neuron/[neuronId]/page.tsx` — **Neuron editor (core feature)**
- `brain/[brainId]/graph/page.tsx` — Knowledge graph visualization
- `favorites/page.tsx` — Favorites listing
- `search/page.tsx` — Search page
- `settings/page.tsx` — Settings page
- `thoughts/page.tsx` — Thoughts listing
- `thoughts/[thoughtId]/page.tsx` — Thought detail
- `trash/page.tsx` — Trash management
- `layout.tsx` — Root layout

### 1.4 Frontend — Untested Component Categories

| Category | Total | Tested | Critical Missing |
|----------|-------|--------|-----------------|
| Sections | 13 | 1 (AudioSection) | RichTextSection, CodeSection, ImageSection, TableSection, DiagramSection, MathSection |
| Layout | 3 | 0 | **Sidebar** (19KB, complex), AppShell, Breadcrumb |
| Editor | 3 | 0 | **TiptapEditor**, Toolbar, InlineCheckbox |
| Graph | 3 | 0 | **GraphCanvas** (13KB, complex), NeuronNode, NodeDetailPanel |
| Neuron | 4 | 0 | AddLinkDialog, ConnectionsPanel, HistoryPanel, ReminderDialog |
| Tags | 2 | 0 | TagCombobox, TagFilterSelect |
| Thoughts | 3 | 0 | ThoughtFormDialog, DeleteThoughtDialog, NeuronViewer |

### 1.5 Frontend — Untested Hooks

6 of 12 hooks have no tests:

- `useNeuronLinks` — link management between neurons
- `useNotifications` — polling-based notification system
- `useSettings` — user settings CRUD
- `useTags` — tag management
- `useThoughts` — thought CRUD
- `useDebounce` — debounce utility (used by autosave)

### 1.6 E2E — Missing User Journeys

**Neuron Links/Connections** — No E2E test exists for creating, viewing, or managing links between neurons. This is a core knowledge-graph feature.

**Nested Cluster Navigation** — `test_02_cluster_crud.py` creates nested clusters via API but never tests navigating through nested hierarchy in the sidebar UI, expanding/collapsing, or breadcrumb navigation.

**Error Handling Paths** — No E2E tests for:
- Validation errors (empty title, special characters, name length limits)
- 404 pages (deleted or non-existent entities)
- Network failure recovery
- Concurrent edit conflict UI (409 response is tested via API only, not the user-facing error)

**Keyboard Shortcuts** — Only Enter key tested for brain creation. Missing: Ctrl+S save, Ctrl+Z undo, Ctrl+B bold, Escape close dialog, Tab navigation.

**Revision Workflow** — `test_06_revisions.py` only checks that the revision list is a list type. Missing: revision diff view, revision comparison, restore with concurrent edits, snapshot creation via UI.

**Import/Export** — No E2E test for exporting a brain or importing from file via UI.

**Bulk Operations** — No tests for multi-select, bulk delete, bulk tag, or bulk move.

**Notifications/Reminders** — No E2E tests despite having backend services.

---

## 2. Test Maintainability Issues

### 2.1 E2E — Severe DRY Violations

**`test_12_dark_mode.py`** — The theme toggle pattern is duplicated 6 times across 100 lines:

```python
# This exact pattern appears 6 times with only the theme name changing:
page.get_by_role("button", name="Theme").click()
page.wait_for_timeout(300)
page.get_by_text("Dark").click()
page.wait_for_timeout(500)
```

**Fix:** Extract to helper:
```python
def set_theme(page, theme: str):
    page.get_by_role("button", name="Theme").click()
    page.wait_for_timeout(300)
    page.get_by_text(theme).click()
    page.wait_for_timeout(500)
```

**`test_03_neuron_crud.py`** — Navigation + networkidle wait pattern repeated 5 times (lines 52, 68, 84, 98, 118). The `navigate()` helper from `page_helpers.py` exists but isn't consistently used.

### 2.2 E2E — Silent Cleanup Failures

**`conftest.py:67-68`** — Fixture cleanup uses bare `except Exception: pass`:

```python
try:
    api.permanent_delete_neuron(neuron["id"])
except Exception:
    pass  # Silent failure — no logging, no visibility into broken cleanup
```

This means broken cleanup goes unnoticed, potentially leaving ghost data that affects other tests.

### 2.3 E2E — Missing Centralized Fixtures

Each test file manages its own cleanup manually. Missing reusable fixtures for common test data combinations:
- Neuron with tags attached
- Neuron with attachments
- Neuron with revision history
- Brain with multiple clusters and neurons (full tree)

### 2.4 E2E — API Client Inconsistency

**`helpers/api_client.py`** — `update_neuron_content()` returns raw `httpx.Response` while all other methods return parsed JSON. This forces test code to manually call `.json()` and check `.status_code`, breaking the abstraction.

### 2.5 Backend — DatabaseCleaner Limited Scope

**`DatabaseCleaner.java`** only truncates 3 tables: `brains`, `tags`, `templates`. It relies on PostgreSQL CASCADE to clean `neurons`, `clusters`, `neuron_links`, `attachments`, `neuron_revisions`, etc. If CASCADE behavior changes or a table is added without a foreign key, cleanup silently fails.

### 2.6 Frontend — Low Test-to-Source Ratio

10 test files covering 72+ source files (14% coverage). As features grow, this gap compounds. No test exists for the core editor workflow (TiptapEditor), the primary layout (Sidebar), or the knowledge graph (GraphCanvas) — the three most complex components.

### 2.7 E2E — Not in CI/CD

`.github/workflows/ci.yml` runs backend (Gradle) and frontend (Vitest) tests but **does not run E2E tests**. E2E regressions can only be caught manually.

---

## 3. Test Reliability Issues (Flaky Tests)

### 3.1 E2E — Hardcoded Timing Waits (15+ Instances)

These `wait_for_timeout()` calls are the primary flakiness risk. They pass on fast machines but fail under load or on CI:

| File | Line | Wait | What It's Waiting For | Risk |
|------|------|------|-----------------------|------|
| `test_01_brain_crud.py` | 40, 59, 97 | 500ms | DOM update after create/rename | Fails on slow render |
| `test_02_cluster_crud.py` | 26, 78 | 1000ms | Cluster creation, sidebar expansion | Fails on slow API |
| `test_03_neuron_crud.py` | 60, 76 | 3000ms | **Autosave debounce** | Fails if debounce > 1.5s or network slow |
| `test_03_neuron_crud.py` | 102, 108 | 500ms | Favorite/pin toggle | Fails on slow state update |
| `test_09_dashboard.py` | 27, 42, 58, 73 | 2000ms | Client-side data fetch | Fails on slow API |
| `test_12_dark_mode.py` | 21,35,45,60,80,97 | 300-500ms | Theme toggle CSS transition | Fails on slow DOM |
| `test_13_navigation.py` | 73 | 1000ms | Sidebar cluster expansion | Fails on slow render |

**Fix pattern:** Replace with Playwright's auto-waiting assertions:
```python
# Bad:
page.wait_for_timeout(500)
assert page.get_by_text("Brain Name").is_visible()

# Good:
expect(page.get_by_text("Brain Name")).to_be_visible(timeout=5000)
```

### 3.2 E2E — Python `time.sleep()` for Search Indexing

**`test_08_search.py:37, 77`** — Uses `time.sleep(1)` to wait for full-text search indexing:

```python
time.sleep(1)  # Hope the search index is updated
page.get_by_placeholder("Search neurons...").fill(unique_word)
```

Search indexing is asynchronous and unpredictable. Should use a retry/poll pattern:
```python
def wait_for_search_result(page, query, expected_text, timeout=10):
    for _ in range(timeout * 2):
        page.get_by_placeholder("Search neurons...").fill(query)
        page.keyboard.press("Enter")
        if page.get_by_text(expected_text).is_visible(timeout=500):
            return
    raise TimeoutError(f"Search for '{query}' didn't find '{expected_text}'")
```

### 3.3 E2E — Autosave Timing Assumption

**`test_03_neuron_crud.py:60, 76`** — Waits 3000ms for autosave then asserts content was persisted. This assumes:
- Debounce timer < 1.5s
- Network round-trip < 1.5s
- No retry/backoff on save failure

If any of these change, the test fails silently or flakes intermittently.

### 3.4 Frontend — Fake Timer Leak Risk

**`useAudioRecorder.test.ts`** — Uses `vi.useFakeTimers()` in `beforeEach` with `vi.useRealTimers()` in `afterEach`. If a test throws before `afterEach` runs, fake timers leak into subsequent tests. Consider using `try/finally` or Vitest's `restoreMocks` config.

### 3.5 Frontend — Non-standard waitFor Usage

**`AudioSection.test.tsx`** — Uses `vi.waitFor()` (Vitest) instead of `waitFor()` from `@testing-library/react`. The RTL version is designed for DOM assertions and handles React batching; the Vitest version doesn't.

### 3.6 E2E — No Retry Logic on Assertions

No E2E test uses retry patterns for eventually-consistent operations (search indexing, async saves, dashboard data loading). A single assertion failure = test failure, even for operations that need a few hundred milliseconds to propagate.

---

## 4. Tests Not Resilient to Code Changes

### 4.1 E2E — Positional Selectors (Breaks on Any DOM Change)

These selectors break when buttons are reordered, added, or wrapped in new containers:

| File | Line | Selector | Risk |
|------|------|----------|------|
| `test_01_brain_crud.py` | 84 | `.locator("button").last` | Breaks if any button added after it |
| `test_01_brain_crud.py` | 121 | `page.locator("button:nth-child(3)")` | Breaks if button order changes |
| `test_02_cluster_crud.py` | 75 | `.locator("button").first` | Breaks if button added before chevron |

### 4.2 E2E — Parent Traversal (Breaks on DOM Restructure)

These use `.locator("..")` to find parent elements — fragile to any wrapper/container changes:

| File | Line | Pattern |
|------|------|---------|
| `test_01_brain_crud.py` | 29 | `page.locator("text=Brains").locator("..")` |
| `test_01_brain_crud.py` | 78-79 | `page.get_by_role("link", name=...).locator("..")` |
| `test_01_brain_crud.py` | 116 | `page.locator(f"a[href=...]").locator("..")` |
| `test_11_trash_page.py` | 45, 66 | `page.get_by_text("...").locator("..")` |

### 4.3 E2E — No `data-testid` Attributes

**The entire E2E suite relies on text content, roles, placeholders, and CSS selectors** — zero `data-testid` usage. Any of these changes break tests:

- **Text content**: `page.get_by_text("No results found")` — breaks if message text changes
- **Placeholder text**: `page.get_by_placeholder("Untitled")`, `page.get_by_placeholder("Name...")` — breaks if placeholder changes
- **Title attributes**: `page.get_by_title("Toggle Favorite")`, `page.get_by_title("Toggle Pin")` — breaks if tooltip text changes
- **CSS classes**: `.locator(".ProseMirror")` — breaks if TipTap editor updates its class names
- **HTML attributes**: `page.locator("html").get_attribute("class")` for theme detection — breaks if theme implementation changes from class-based to CSS custom properties

**Recommendation:** Add `data-testid` attributes to critical interactive elements:
```
data-testid="brain-list"
data-testid="cluster-tree"
data-testid="neuron-editor"
data-testid="btn-create-brain"
data-testid="btn-toggle-favorite"
data-testid="theme-toggle"
data-testid="search-input"
```

### 4.4 E2E — Fixed Test Data Names (Breaks Under Parallel Execution)

Tests use static names that collide if run in parallel or if previous cleanup failed:

```python
# test_01_brain_crud.py
brain_name = "Browser Created Brain"      # Collision risk
renamed_name = "Renamed Brain E2E"        # Collision risk

# test_02_cluster_crud.py  
"API Created Cluster"                     # Collision risk
```

Some tests use `os.urandom(4).hex()` suffix (good), but not consistently.

### 4.5 E2E — Theme Test State Leaks

**`test_12_dark_mode.py`** — Sets the theme to Dark during tests. If a test fails mid-way, the theme stays in Dark mode for all subsequent tests. No `autouse` fixture resets theme to default.

### 4.6 Frontend — Next.js Internal Mocking

**`home.test.tsx`** — Mocks `next/link` and `next/navigation`:

```typescript
vi.mock('next/link', () => ({ default: ... }));
vi.mock('next/navigation', () => ({ useRouter: ... }));
```

This is tightly coupled to Next.js internals. A Next.js major version upgrade (e.g., 16 → 17) that changes these module paths will silently break tests.

### 4.7 Backend — TestDataFactory Coupled to Service API

**`TestDataFactory.java`** creates test data by calling service methods directly. If a service method signature changes (e.g., `createBrain(String name)` → `createBrain(CreateBrainRequest request)`), every test that uses the factory breaks — even tests unrelated to that service.

---

## 5. Summary

### Coverage Heatmap

| Layer | Area | Coverage | Priority |
|-------|------|----------|----------|
| Backend | Core CRUD (Brain/Cluster/Neuron) | High | - |
| Backend | Tags, Links, Revisions, Search | High | - |
| Backend | Attachments, Import/Export, Stats | Medium (service only) | P2 |
| Backend | **Notifications, Reminders, Settings, Thoughts** | **None** | **P1** |
| Frontend | API client, core hooks | Medium | - |
| Frontend | **Pages (11/12 untested)** | **Critical** | **P1** |
| Frontend | **Complex components (Editor, Sidebar, Graph)** | **None** | **P1** |
| Frontend | UI primitives (Button, etc.) | Low | P3 |
| E2E | Brain/Cluster/Neuron CRUD | Good | - |
| E2E | Search, Dashboard, Trash, Dark Mode | Basic | P2 |
| E2E | **Links, Error paths, Keyboard shortcuts** | **None** | **P1** |
| E2E | **CI/CD integration** | **Not in pipeline** | **P1** |

### Top 10 Recommendations

1. **Add E2E tests to CI/CD** — Currently not automated; regressions go undetected
2. **Test Notifications/Reminders/Settings/Thoughts backend** — Four features with zero coverage
3. **Test Neuron editor page** — The core user-facing feature has no frontend or E2E page test
4. **Replace hardcoded waits with Playwright auto-waiting** — 15+ flaky timing dependencies
5. **Add `data-testid` attributes** — Eliminate DOM-structure coupling in E2E selectors
6. **Test neuron links E2E** — Core knowledge-graph feature completely untested end-to-end
7. **Add error path E2E tests** — No validation, 404, or network failure tests exist
8. **Extract E2E helpers** — DRY violations in theme toggle, navigation, and cleanup patterns
9. **Fix silent cleanup failures** — Log or fail-fast on `except Exception: pass` in fixtures
10. **Use unique test data names** — Prevent parallel execution collisions
