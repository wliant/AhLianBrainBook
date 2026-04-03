# DEF-004: Line Number Not Highlighted When Adding Neuron in Project Cluster

## Status
Open

## Severity
Low

## Summary
When adding a neuron anchored to a specific line in the file editor of a project cluster, the target line number is not visually highlighted. This makes it unclear which line the neuron will be anchored to.

## Steps to Reproduce
1. Open a project cluster with a provisioned sandbox (or URL browse mode)
2. Open a file in the code viewer
3. Click on a line to add a neuron anchor
4. Observe that the line is not highlighted

## Expected Behavior
The line where the neuron anchor will be placed should be visually highlighted (e.g., background color change, gutter marker) to confirm the selection before creating the neuron.

## Actual Behavior
No visual feedback is given on the selected line.

## Proposed Fix
Add a CSS highlight class to the selected line in the CodeMirror editor when the user clicks to add a neuron. The highlight should persist until the neuron creation is confirmed or cancelled.

## Affected Components
- **Frontend**: Code viewer component (CodeMirror integration), anchor creation flow
