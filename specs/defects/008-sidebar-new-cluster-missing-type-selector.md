# DEF-008: Sidebar Context Menu "New Cluster" Missing Type Selector

## Status
Closed

## Severity
Medium

## Summary
When creating a new cluster from the sidebar context menu (right-click or "+" button on a brain), the dialog does not show the cluster type selector (Knowledge / AI Research / Project). It only shows the name input, defaulting to a Knowledge cluster with no way to choose a different type.

## Steps to Reproduce
1. Right-click on a brain in the sidebar (or click the "+" context action)
2. Select "New Cluster" from the context menu
3. Observe that the dialog only has a name input field
4. No type selection (Knowledge / AI Research / Project) is available

## Expected Behavior
The sidebar "New Cluster" dialog should include the same type selector as the one accessible from the brain detail page's "New Cluster" button, allowing the user to choose between Knowledge, AI Research, and Project cluster types.

## Actual Behavior
The sidebar dialog only accepts a cluster name. The cluster is created as a Knowledge type by default with no option to select a different type.

## Proposed Fix
Reuse the same `NewClusterDialog` component (with type radio buttons and optional repo URL field) in the sidebar context menu flow, or extend the sidebar's inline dialog to include the type selector.

## Affected Components
- **Frontend**: Sidebar component (`Sidebar.tsx`), cluster creation dialog/inline form
