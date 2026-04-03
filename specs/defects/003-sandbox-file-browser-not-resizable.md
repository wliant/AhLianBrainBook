# DEF-003: Sandbox File Browser Panel Not Resizable

## Status
Open

## Severity
Low

## Summary
The file browser panel in the project cluster view has a fixed width and cannot be resized by the user. For repositories with deeply nested directories or long file names, the panel is too narrow to comfortably navigate.

## Steps to Reproduce
1. Open a project cluster with a provisioned sandbox
2. Attempt to drag or resize the file browser panel on the left side
3. Observe that the panel width is fixed

## Expected Behavior
The file browser panel should be resizable via a drag handle, allowing the user to adjust the width of the file tree, code viewer, and neuron panel.

## Actual Behavior
All three panels (file tree, code viewer, neuron panel) have fixed widths with no resize capability.

## Proposed Fix
Add a draggable resize handle between the panels, similar to VS Code's sidebar behavior. Consider using a library like `react-resizable-panels` or implementing a simple drag-to-resize with CSS `resize` or pointer event handlers.

## Affected Components
- **Frontend**: `ProjectClusterView.tsx` layout
