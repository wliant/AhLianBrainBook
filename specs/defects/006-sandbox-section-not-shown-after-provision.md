# DEF-006: Sandbox Section Not Shown in Sidebar After Provisioning

## Status
Open

## Severity
Medium

## Summary
When a sandbox is provisioned, the "Sandboxes" section in the sidebar does not appear until the page is manually refreshed. The sandbox is successfully created on the backend, but the sidebar does not reactively update.

## Steps to Reproduce
1. Open a project cluster
2. Click "Provision Sandbox" and complete the provisioning
3. Observe the sidebar - the "Sandboxes" section does not appear
4. Refresh the page
5. The "Sandboxes" section now appears with the provisioned sandbox listed

## Expected Behavior
The sidebar "Sandboxes" section should appear immediately after a sandbox is successfully provisioned, without requiring a page refresh.

## Actual Behavior
The sidebar does not update. A full page refresh is needed to see the new sandbox entry.

## Root Cause
The sidebar's sandbox list query is not invalidated when a new sandbox is provisioned. The `useSandbox` hook invalidates `["sandboxes"]` queries, but the sidebar may use a different query key or the `useSandboxList` hook is not properly subscribed to the invalidation.

## Proposed Fix
Ensure that `invalidateSandboxQueries()` in `useSandbox.ts` triggers a refetch of the sidebar's sandbox list. Verify that `useSandboxList` uses the `["sandboxes"]` query key and is properly reactive.

## Affected Components
- **Frontend**: `useSandbox.ts` (invalidation), `useSandboxList.ts`, `Sidebar.tsx`
