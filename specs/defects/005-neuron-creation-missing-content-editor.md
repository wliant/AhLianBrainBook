# DEF-005: Neuron Creation in Project Cluster Only Captures Title

## Status
Open

## Severity
Medium

## Summary
When adding a neuron from the file editor in a project cluster, only the neuron title can be entered. There is no way to add neuron content (rich text body) during creation. Users must create the neuron first, then navigate to it separately to add content.

## Steps to Reproduce
1. Open a project cluster
2. Open a file in the code viewer
3. Click to add a neuron at a specific line
4. Observe that the creation dialog only has a title field

## Expected Behavior
The neuron creation dialog should include a rich text editor section for the neuron content/body, allowing the user to add notes, context, or explanations at creation time.

## Actual Behavior
Only a title input is provided. Content must be added in a separate step after navigating to the created neuron.

## Proposed Fix
Extend the neuron creation dialog/inline form in the project cluster view to include a rich text section below the title. A simple TipTap editor instance (reusing the existing editor component) would be sufficient. The content should be saved along with the title when the neuron is created.

## Affected Components
- **Frontend**: Neuron creation flow in `ProjectClusterView.tsx`, anchor panel
- **Backend**: No changes needed (neuron creation API already accepts content)
