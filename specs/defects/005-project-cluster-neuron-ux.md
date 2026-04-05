# DEF-005: Project Cluster Neuron Creation and Display UX

## Status
Closed

## Severity
Medium

## Summary
Neurons in project clusters have different requirements from regular neurons but currently use the same minimal creation flow. Project cluster neurons need a simplified, purpose-built structure: title, file/line callout, and a rich text section. Additionally, the neuron list panel on the right side of the project cluster view should be expandable to show neuron content inline.

## Current Behavior
- Neuron creation only captures a title
- No way to add content at creation time
- The right-side neuron list only shows neuron titles with no way to expand and view content

## Expected Behavior

### Neuron Structure
Project cluster neurons should have a distinct, simplified layout:
1. **Title** — editable text field
2. **Callout section** — info-style callout showing the anchored file path and line number (read-only, derived from the anchor)
3. **Rich text section** — a single TipTap rich text editor for the user to write notes, explanations, or context

This is intentionally simpler than regular neurons (no slash command menu, no complex block structure).

### Neuron List Panel (Right Side)
The neuron list panel in the project cluster view should support expandable entries:
- Default view: collapsed, showing only the neuron title and file/line callout
- Click to expand: reveals the rich text content inline within the panel
- Expand/collapse toggle per neuron entry
- This allows users to read and review anchored notes without navigating away from the code view

### Neuron Creation Flow
When adding a neuron from the code viewer:
1. Title input field
2. Rich text editor section (editable immediately)
3. File path and line number auto-populated as a callout (read-only)
4. Save creates the neuron with all three sections populated

## Proposed Fix

### Creation Dialog
- Extend the neuron creation form in `ProjectClusterView.tsx` to include a TipTap editor below the title
- Auto-populate the file path and line number callout from the anchor context
- Save title + content together on creation

### Neuron List Panel
- Wrap each neuron entry in an expandable/collapsible container
- Collapsed: title + file:line badge
- Expanded: title + file:line callout + rich text content (read-only or inline-editable)
- Use a chevron icon or click-to-toggle interaction

## Affected Components
- **Frontend**: `ProjectClusterView.tsx` (neuron creation form, anchor panel), neuron list/anchor panel component
- **Backend**: No changes needed (neuron creation API already accepts content)
