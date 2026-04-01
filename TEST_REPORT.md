# Test Report - 2026-04-01

## Summary

| Suite | Passed | Failed | Total | Status |
|-------|--------|--------|-------|--------|
| Backend (JUnit 5 + TestContainers) | 254 | 0 | 254 | PASS |
| Frontend (Vitest + RTL + MSW) | 126 | 0 | 126 | PASS |
| E2E (pytest + Playwright) | 186 | 0 | 186 | PASS |
| **Total** | **566** | **0** | **566** | **PASS** |

## Bugs Found & Fixed This Session

### 1. HikariCP Connection Pool Exhaustion (Critical)

**Symptom:** App becomes completely unusable after a few page loads. All API endpoints return 500.

**Root cause:** `spring.jpa.open-in-view` defaulting to `true` held a JDBC connection for the entire HTTP request lifecycle. The SSE `/api/notifications/stream` endpoint used `SseEmitter(0L)` (infinite timeout), so each browser `EventSource` connection permanently held a DB connection, exhausting the 10-connection pool.

**Fix:**
- `app/src/main/resources/application.yml` — added `spring.jpa.open-in-view: false`
- `NotificationSseService.java` — changed `SseEmitter(0L)` to `SseEmitter(300_000L)`

### 2. Stale Data After Mutations (Browser HTTP Cache)

**Symptom:** Sidebar didn't reflect brain deletions/renames. API returned correct data but browser served cached responses.

**Root cause:** `/api/brains` had `Cache-Control: max-age=60`. After mutations, TanStack Query refetched but the browser returned the stale cached response.

**Fix:** `web/src/lib/api.ts` — added `cache: "no-cache"` for GET requests so the browser always revalidates with the server.

### 3. Spaced Repetition neuronId Null in Response

**Symptom:** `POST /api/spaced-repetition/items/{neuronId}` returned `neuronId: null`.

**Root cause:** The `SpacedRepetitionItem.neuronId` field was mapped as `insertable=false, updatable=false` (shared column with `@ManyToOne neuron`). After save, the field wasn't populated until re-read from DB.

**Fix:** `SpacedRepetitionService.toResponse()` — changed `item.getNeuronId()` to `item.getNeuron().getId()`.

## E2E Test Fixes

### Reminder Tests (8 tests fixed)
E2E tests used outdated singular `/api/neurons/{id}/reminder` endpoints after the multi-reminder feature changed them to plural `/api/neurons/{id}/reminders` with `reminderId` path params. Browser tests referenced old dialog-based UI (`reminder-dialog`) instead of new panel UI (`reminder-panel`).

### Brain CRUD & Navigation Tests (3 tests fixed)
Browser HTTP cache caused tests to see stale brains list after API-created data. Fixed with Playwright route interception to bypass cache.

## New Test Coverage Added

| Area | Backend | Frontend | E2E | Total |
|------|---------|----------|-----|-------|
| Thoughts | 12 | 4 | 15 | 31 |
| Spaced Repetition | 24 | 14 | 17 | 55 |

## Exploratory Testing (Browser)

All pages verified working:

| Page | Status |
|------|--------|
| Dashboard | OK |
| Brain CRUD | OK |
| Cluster CRUD | OK |
| Neuron Editor | OK |
| Search | OK |
| Favorites | OK |
| Trash | OK |
| Review | OK |
| Thoughts | OK |
| Settings | OK |
| Knowledge Graph | OK |
| Theme Toggle | OK |
| 404 Page | OK |
| Notifications | OK |
