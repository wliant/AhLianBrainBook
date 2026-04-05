# DEF-007: No Loading Indicator During Sandbox Cloning

## Status
Closed

## Severity
Medium

## Summary
When a sandbox is provisioned, the backend begins cloning the repository asynchronously. During this cloning period, the page does not show any loading/spinning indicator. The user has no feedback that the clone is in progress, and the view does not automatically transition to sandbox mode when cloning completes.

## Steps to Reproduce
1. Open a project cluster in URL browse mode
2. Click "Provision Sandbox" and confirm
3. Observe that the page remains in URL browse mode with no loading indicator
4. Wait for the clone to complete (may take seconds to minutes depending on repo size)
5. The page does not automatically switch to sandbox mode

## Expected Behavior
1. After clicking "Provision", the page should show a loading/spinning indicator with a message like "Cloning repository..."
2. The page should poll the sandbox status during cloning
3. Once the sandbox status transitions to `active`, the view should automatically switch to sandbox mode (sandbox file tree, status bar, etc.)

## Actual Behavior
No loading indicator is shown. The page stays in URL browse mode. The user must manually refresh or navigate away and back to see the sandbox mode.

## Root Cause
The `useSandbox` hook has polling logic for transitional states (`cloning`, `indexing`, `terminating`) via `refetchInterval`, but the `ProjectClusterView` component does not render a loading state when `sandbox.status === "cloning"`.

## Proposed Fix
1. In `ProjectClusterView`, check for `sandbox?.status === "cloning" || sandbox?.status === "indexing"` and render a centered spinner with status text
2. The existing `refetchInterval` polling (every 3 seconds) in `useSandbox.ts` will automatically detect when the sandbox becomes `active`
3. Once active, the view should re-render into sandbox mode seamlessly

## Affected Components
- **Frontend**: `ProjectClusterView.tsx` (add cloning/indexing state rendering)
