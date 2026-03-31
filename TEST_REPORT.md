# Test Report - 2026-03-31

## Summary

| Suite | Passed | Failed | Total | Status |
|-------|--------|--------|-------|--------|
| Backend (app) | all | 0 | all | PASS |
| Frontend (web) | 52 tests (12 files) | 0 | 52 tests (12 files) | PASS |
| E2E | 118 | 19 | 137 | FAIL |

---

## E2E (Playwright + pytest) - `uv run pytest`

### Failed: 19 (118 passed)

Failures grouped by root cause:

### 1. Test Code Bugs - Playwright API misuse (2 failures)

| Test | Error | Root Cause |
|------|-------|------------|
| `test_03_neuron_crud::test_create_neuron_from_cluster_page` | `playwright._impl._errors.Error: value must be a string or regular expression` | `expect(page).to_have_url(lambda url: ...)` passes a lambda, but `to_have_url()` requires a string or regex |
| `test_16_keyboard_shortcuts::test_ctrl_k_opens_search` | `playwright._impl._errors.Error: value must be a string or regular expression` | Same lambda-in-`to_have_url()` issue |

**Fix:** Replace `lambda` with `re.compile(r".*pattern.*")` in these assertions.

### 2. Strict Mode Violations - Duplicate elements on page (6 failures)

| Test | Error | Root Cause |
|------|-------|------------|
| `test_16_keyboard_shortcuts::test_question_mark_opens_shortcuts_dialog` | `get_by_text("Keyboard Shortcuts")` resolved to 2 elements | Dialog heading + sidebar text both match |
| `test_16_keyboard_shortcuts::test_escape_closes_dialog` | Same as above | Same duplicate locator issue |
| `test_17_revision_workflow::test_history_panel_opens` | `get_by_text("History")` resolved to 2 elements | Panel heading + "No history yet..." text both match |
| `test_20_notifications::test_notification_bell_visible` | `get_by_test_id("notification-bell")` resolved to 2 elements | Two notification bell buttons rendered on page |
| `test_20_notifications::test_notification_popover_opens` | Same as above | Same duplicate bell button |
| `test_20_notifications::test_empty_notifications_state` | Same as above | Same duplicate bell button |

**Fix for keyboard shortcuts/history:** Use `get_by_role("heading", name="...")` instead of `get_by_text(...)`.
**Fix for notifications:** The app renders two `notification-bell` test IDs - either fix the app to render only one, or use `.first` in tests.

### 3. UI Interaction - Cluster creation dialog not working (1 failure)

| Test | Error | Root Cause |
|------|-------|------------|
| `test_02_cluster_crud::test_create_cluster_from_brain_page` | Element not found after creating cluster via dialog | The new cluster dialog (from defectfix branch) may have changed the creation flow; test may need to interact with the new dialog rather than the old `prompt()` pattern |

### 4. API Behavior Mismatch (3 failures)

| Test | Error | Root Cause |
|------|-------|------------|
| `test_03_neuron_crud::test_toggle_favorite` | `assert updated["isFavorite"] is True` | API PATCH to toggle favorite returns `isFavorite: false` - the toggle endpoint or test's API call is wrong |
| `test_17_revision_workflow::test_restore_revision_via_ui` | `409 Conflict` on content update | Test increments version by 1 but the actual version may have advanced further (optimistic locking conflict) |
| `test_08_search::test_search_with_brain_filter` | `KeyError: 'id'` in search results | Search API response structure changed - results no longer have an `id` field at the expected path |

### 5. Export API Response Structure Changed (1 failure)

| Test | Error | Root Cause |
|------|-------|------------|
| `test_18_import_export::test_export_brain` | `KeyError: 'name'` | Export API response doesn't have a `name` field at the top level - API response structure changed |

### 6. Reminders API - All endpoints return 400 (6 failures)

| Test | Error |
|------|-------|
| `test_19_reminders::test_create_reminder` | `400 Bad Request` on POST |
| `test_19_reminders::test_get_reminder` | `400 Bad Request` on POST (setup) |
| `test_19_reminders::test_update_reminder` | `400 Bad Request` on POST (setup) |
| `test_19_reminders::test_delete_reminder` | `400 Bad Request` on POST (setup) |
| `test_19_reminders::test_no_reminder_returns_none` | `JSONDecodeError` on GET (empty body) |
| `test_19_reminders::test_existing_reminder_shows_delete_button` | `400 Bad Request` on POST (setup) |

**Root Cause:** The reminder creation API (`POST /api/neurons/{id}/reminder`) rejects all requests with 400. Either the request payload format from the test client doesn't match what the API expects, or the reminder feature has a validation bug.

---

## Priority Fix Recommendations

### P0 - Blocking / App Bugs
1. **Reminders API 400 errors** - All reminder endpoints fail. Investigate the expected request body format vs what tests send.

### P1 - Test Accuracy
2. **Search API response structure** - `test_search_with_brain_filter` and `test_export_brain` fail due to changed response shapes. Update test assertions to match current API.
3. **Favorite toggle** - Either the API or the test has wrong assumptions about how toggling works.
4. **Cluster creation dialog** - Test needs updating for the new dialog-based creation flow.

### P2 - Test Code Quality
5. **Playwright lambda in `to_have_url()`** - Replace with `re.compile()` (2 tests).
6. **Strict mode violations** - Use more specific locators: `get_by_role("heading", ...)` or `.first` (6 tests).
7. **Optimistic locking in revision test** - Fetch current version before updating instead of assuming `version + 1`.

### P3 - Low Priority
8. **Duplicate notification-bell elements** - App renders bell in two places; consider if this is intentional.
