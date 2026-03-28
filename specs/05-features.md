# Features Specification

## Rich Text Editing

### Editor
- TipTap-based rich text editor with comprehensive toolbar
- Content stored in dual format: JSONB (TipTap JSON for rendering) and plain text (for full-text search)
- Auto-save with 1.5-second debounce after content changes
- Save status indicator: idle / saving / saved / error

### Supported Formatting
- **Inline:** Bold, italic, underline, strikethrough, inline code, highlight (multicolor)
- **Block:** Headings (H1-H3), bullet lists, ordered lists, task/checkbox lists, blockquotes, horizontal rules
- **Rich content:** Tables (with header rows/cells), links, images
- **Code:** Syntax-highlighted code blocks (via lowlight)
- **Typography:** Smart quotes, em/en dashes (automatic)
- **History:** Undo / redo

## Content Versioning

### Optimistic Locking
- Each neuron has a `version` field starting at 1
- Content updates require the client to send `clientVersion` matching the server's version
- On success, server increments version and returns the updated neuron
- On mismatch, server returns `409 Conflict` -- prevents concurrent edit data loss
- Client tracks version locally via `versionRef` and updates on successful save

### Revision History
- Snapshots stored in `neuron_revisions` table with sequential `revisionNumber`
- Each revision captures `contentJson` and `contentText` at a point in time
- Revisions can be listed and individually viewed
- Restoring a revision overwrites the neuron's content and increments its version

## Organization

### Hierarchy
- **Brain** -- top-level container (e.g., a subject area or project)
- **Cluster** -- folder within a brain, supports nesting via `parentClusterId` (tree structure)
- **Neuron** -- individual note, belongs to a brain and optionally a cluster

### Sorting
- All entities have a `sortOrder` field for manual ordering
- Reorder endpoint accepts an ordered list of IDs and sets `sortOrder` by index position

### Archiving
- Brains, clusters, and neurons support soft archiving (`isArchived` flag)
- Archived items are excluded from default list queries
- Archive and restore are separate toggle endpoints

### Soft Delete (Trash)
- Neurons support soft delete (`isDeleted` flag)
- `DELETE /api/neurons/{id}` moves to trash (sets `isDeleted = true`)
- Trash page lists deleted neurons with restore and permanent delete options
- `POST /api/neurons/{id}/restore-from-trash` restores (sets `isDeleted = false`)
- `DELETE /api/neurons/{id}/permanent` removes from database permanently

### Moving
- Clusters can be moved to a different brain
- Neurons can be moved to a different brain and/or cluster

### Duplication
- Neurons can be duplicated: creates a copy with title + " (copy)", version reset to 1, sortOrder incremented by 1

## Tagging

- Tags are globally unique by name, with optional color
- Many-to-many relationship between neurons and tags via `neuron_tags` join table
- Add/remove tag from neuron is idempotent (ON CONFLICT DO NOTHING on add)
- Tags searchable by name (case-insensitive contains)
- Deleting a tag cascades to remove all neuron associations

## Favorites & Pinning

- **Favorite:** Toggle `isFavorite` flag on a neuron; favorites listed on dashboard and dedicated page
- **Pin:** Toggle `isPinned` flag on a neuron; pinned neurons shown prominently on dashboard
- Both are toggle endpoints (flip the current boolean value)

## File Attachments

- Files uploaded via multipart form to MinIO object storage
- Stored with UUID-prefixed key: `{uuid}/{original-filename}`
- Metadata (filename, path, size, content type) saved in `attachments` table
- Download returns binary file with appropriate content type
- Delete removes from both MinIO and database
- Max upload size: 50MB

## Templates

- Reusable content structures stored as TipTap JSON
- Templates have a name, optional description, and `contentJson`
- Can be associated with neurons via `templateId` field
- CRUD operations available for template management

## Full-Text Search

- PostgreSQL-native full-text search using tsvector/tsquery
- Indexed on `neurons.content_text` column with GIN index
- Supports optional filtering by `brainId` and/or `clusterId`
- Paginated results with `page` and `size` parameters
- Returns matching neurons with total count

## Dashboard

Three sections displayed on the home page:
1. **Pinned neurons** -- neurons with `isPinned = true`
2. **Favorite neurons** -- neurons with `isFavorite = true`
3. **Recent neurons** -- last 10 neurons ordered by `lastEditedAt` descending

Each neuron links directly to its editor page.

## Navigation

- Brain list serves as primary navigation (sidebar or main page)
- Drill-down: Brain -> Clusters -> Neurons -> Editor
- Deep linking supported via URL: `/brain/{brainId}/cluster/{clusterId}/neuron/{neuronId}`
- Dedicated pages for favorites, search, and trash
