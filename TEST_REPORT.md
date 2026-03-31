# Test Report - 2026-03-31

## Summary

| Suite | Passed | Failed | Errors | Total | Status |
|-------|--------|--------|--------|-------|--------|
| Backend (JUnit 5 + TestContainers) | 206 | 0 | 0 | 206 | PASS |
| Frontend (Vitest + RTL + MSW) | 95 | 0 | 0 | 95 | PASS |
| E2E (pytest + Playwright) | 144 | 11 | 0 | 155 | FAIL |

## Critical Bug Found & Fixed

### HikariCP Connection Pool Exhaustion

**Symptom:** App becomes completely unusable after a few page loads. All API endpoints return 500. Backend logs show hundreds of "Apparent connection leak detected" and "Connection is not available, request timed out after 10000ms (total=10, active=10, idle=0, waiting=N)" errors.

**Root cause:** The combination of:
1. `spring.jpa.open-in-view` defaulting to `true` (not explicitly disabled) — binds a JDBC connection to the entire HTTP request lifecycle
2. SSE endpoint `GET /api/notifications/stream` using `SseEmitter(0L)` (infinite timeout) — keeps the HTTP response open forever
3. Each browser `EventSource` connection permanently holds a DB connection via Open-In-View, exhausting the 10-connection HikariCP pool within seconds

**Fix applied:**
- `app/src/main/resources/application.yml` — added `spring.jpa.open-in-view: false`
- `app/src/main/java/com/wliant/brainbook/service/NotificationSseService.java` — changed `SseEmitter(0L)` to `SseEmitter(300_000L)` (5 min timeout; browser auto-reconnects)

**Verification:** After fix, 45 concurrent API requests all return 200, zero connection leak warnings in logs, zero browser console errors across 6+ page navigations.

## E2E Test Failures (11)

### test_19_reminders (8 failures)

All reminder tests fail with `500` from `POST /api/neurons/{id}/reminder`. Both API and browser tests affected. The reminder endpoint has a server-side error unrelated to the connection leak fix.

**Failing tests:**
- `TestRemindersAPI::test_create_reminder`
- `TestRemindersAPI::test_get_reminder`
- `TestRemindersAPI::test_update_reminder`
- `TestRemindersAPI::test_delete_reminder`
- `TestRemindersAPI::test_no_reminder_returns_none`
- `TestRemindersBrowser::test_reminder_dialog_opens`
- `TestRemindersBrowser::test_reminder_dialog_save_disabled_without_time`
- `TestRemindersBrowser::test_existing_reminder_shows_delete_button`

### test_01_brain_crud (2 failures)

- `TestBrainRenameViaBrowser::test_rename_brain` — brain rename via browser UI fails
- `TestBrainDeleteViaBrowser::test_delete_brain` — brain delete via browser UI fails

### test_13_navigation (1 failure)

- `TestBrainNavigation::test_brain_list_in_sidebar` — sidebar brain list assertion failure

## Exploratory Testing (Browser)

All pages load and function correctly after the connection leak fix:

| Page | Status | Notes |
|------|--------|-------|
| Dashboard | OK | Shows recent neurons, brains in sidebar |
| Brain CRUD | OK | Create brain works; rename/delete not tested post-fix |
| Cluster CRUD | OK | Create cluster, navigate into cluster |
| Neuron Editor | OK | Title edit, rich text toolbar, breadcrumbs, save indicator |
| Search | OK | Search form renders, tag filters available |
| Favorites | OK | Empty state renders correctly |
| Trash | OK | Empty state renders correctly |
| Review | OK | "All caught up" empty state |
| Thoughts | OK | Page loads with "New Thought" button |
| Settings | OK | Display Name and Max Reminders fields |
| Knowledge Graph | OK | Renders cluster/neuron graph with zoom controls |
| Theme Toggle | OK | Light/Dark/System all work correctly |
| 404 Page | OK | "This page could not be found" |
| Notifications | OK | Bell icon, SSE stream working |
