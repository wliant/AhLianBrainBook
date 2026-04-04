# Features Specification

## 1. Section-Based Content Editing

Neurons use a section-based content architecture. Each neuron contains an ordered list of sections, where each section has its own type and editor. Users can add sections between existing sections, reorder them (move up/down), and delete them.

### 1.1 Rich Text Sections
- TipTap-based rich text editor with comprehensive formatting toolbar
- **Inline formatting:** Bold, italic, underline, strikethrough, inline code, highlight (multicolor)
- **Block formatting:** Headings (H1–H3), bullet lists, ordered lists, task/checkbox lists (interactive, nestable), blockquotes, horizontal rules
- **Rich content:** Tables (with header rows/cells), links (internal and external), images
- **Wiki links:** `[[` syntax triggers autocomplete for linking to other neurons; creates `NeuronLink` records with `source='editor'`
- **Slash command menu:** `/` triggers an insertable command menu for sections (code, math, diagram, callout, table, image, audio, divider) and formatting (headings, lists, blockquote)
- **Code blocks:** Syntax-highlighted code blocks (via lowlight)
- **Typography:** Smart quotes, em/en dashes (automatic)
- **History:** Undo / redo

### 1.2 Code Sections
- Monaco Editor (same engine as VS Code)
- Syntax highlighting for 28+ languages: JavaScript, TypeScript, Python, Java, Go, Rust, SQL, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala, Dart, HTML, CSS, JSON, YAML, XML, Markdown, Shell/Bash, PowerShell, R, Lua, Perl, and more
- Resizable editor area
- Title and language selector per section

### 1.3 Math Sections
- LaTeX input with live rendered preview using KaTeX
- Supports full mathematical notation (equations, matrices, symbols, etc.)

### 1.4 Diagram Sections
- Mermaid.js-based diagram authoring
- Supports flowcharts, sequence diagrams, class diagrams, state diagrams, Gantt charts, and other Mermaid diagram types
- Live preview rendering

### 1.5 Callout Sections
- Styled information boxes in 4 variants: **Info**, **Warning**, **Tip**, **Note**
- Each variant has distinct visual styling (color, icon)
- Editable text content

### 1.6 Table Sections
- Editable tables with dynamic add/remove rows and columns
- Inline cell editing

### 1.7 Image Sections
- Upload from file or insert via URL
- Paste support (paste image from clipboard)
- Stored as attachments in MinIO

### 1.8 Audio Sections
- Upload audio files from disk
- Built-in voice recording using the browser's MediaRecorder API
- Playback within the section

### 1.9 Divider Sections
- Horizontal separator between content sections

### Section Performance
- Code, Math, and Diagram section editors are lazy-loaded to minimize initial page load

## 2. Auto-Save & Save Status

- Content auto-saves after 1.5 seconds of inactivity (debounced)
- Save status indicator shows current state: **idle**, **saving**, **saved**, **error**
- Both section JSON (for rendering) and extracted plain text (for search) are saved together

## 3. View / Edit Mode

- Neurons support toggling between a read-only view mode and an edit mode
- View mode renders content without editing controls for distraction-free reading
- Edit mode shows full toolbars, section management controls, and inline editing

## 4. Content Versioning

### 4.1 Optimistic Locking
- Each neuron has a `version` field starting at 1
- Content updates require the client to send `clientVersion` matching the server's version
- On success, the server increments the version and returns the updated neuron
- On mismatch, the server returns `409 Conflict` — prevents concurrent edit data loss
- Client tracks version locally via `versionRef` and updates on successful save

### 4.2 Revision History
- Manual snapshots: users can explicitly create a revision snapshot at any time
- Automatic snapshots: a scheduled backend service periodically creates snapshots
- Each revision captures title, contentJson, and contentText at a point in time
- Revisions are numbered sequentially per neuron
- Users can:
  - View all revisions with timestamps
  - Preview a specific revision's content
  - Restore a revision (overwrites neuron content, increments version)
  - Delete individual revisions

## 5. Organization

### 5.1 Hierarchy
- **Brain** — top-level container (e.g., a subject area or project). Has name, description, icon, and color.
- **Cluster** — a typed learning activity within a brain. Type determines UI and behavior (`knowledge`, `ai-research`, `project`, `todo`). Flat structure (no nesting).
- **Neuron** — individual note. Belongs to a brain and optionally a cluster.

### 5.2 Sorting
- All entities (brains, clusters, neurons) have a `sortOrder` field for manual ordering
- Reorder endpoints accept an ordered list of IDs and set `sortOrder` by index position

### 5.3 Archiving
- Brains, clusters, and neurons support soft archiving (`isArchived` flag)
- Archived items are excluded from default list queries
- Archive and restore are separate toggle endpoints

### 5.4 Soft Delete (Trash)
- Neurons support soft delete (`isDeleted` flag)
- `DELETE /api/neurons/{id}` moves to trash (sets `isDeleted = true`)
- Trash page lists deleted neurons with restore and permanent delete options
- Permanent delete removes from database irreversibly

### 5.5 Moving
- Clusters can be moved to a different brain
- Neurons can be moved to a different brain and/or cluster

### 5.6 Duplication
- Neurons can be duplicated: creates a copy with title + " (copy)", version reset to 1, sortOrder incremented by 1

## 6. Cluster Types

Clusters support three types that determine their behavior and content model:

| Type | Purpose | Content | Who authors |
|------|---------|---------|-------------|
| **Knowledge** (default) | Free-form note-taking | Neurons with sections (rich-text, code, math, etc.) | Human (AI assists per-section) |
| **AI Research** | AI-generated learning tracker | Research topics with structured bullet trees + completeness tracking | AI (user triggers and curates) |
| **Project** | Codebase exploration (planned) | Not yet implemented | — |

- Type is set at cluster creation and cannot be changed
- `ai-research` and `project` types enforce a uniqueness constraint: only one non-archived cluster of each type per brain
- The cluster page routes to the appropriate view based on type

## 7. AI Research Cluster

A learning gap analysis tool for technical learners. It answers: *"For this domain, what should I know, and how much of it have I actually written about?"*

### 7.1 Research Goal
- LLM-generated on cluster creation from the brain's name and existing knowledge neurons
- User-editable after creation
- Provides overarching context for all topic generation and scoring
- Example: *"Understand Spring Security well enough to design and implement authentication and authorization for enterprise Java applications."*

### 7.2 Research Topics
- AI-generated structured bullet trees covering what the user should learn
- Each topic has: title, prompt (user's original request), content (hierarchical bullet tree), overall completeness, and status
- **User capabilities:** create, delete, reorder, update (re-score), expand bullets
- **Users cannot** directly edit bullet content — AI manages the content

### 7.3 Bullet Tree Structure
Hierarchical bullet points where each item has:
- **Text** — concept name
- **Explanation** — what to learn about it
- **Completeness** — discrete level (`none`, `partial`, `good`, `complete`) rated by AI
- **Linked neuron IDs** — auto-discovered knowledge neurons relevant to this point
- **Children** — nested sub-points (recursive)

### 7.4 Completeness Scoring
Discrete levels rated by AI based on how thoroughly the brain's knowledge neurons cover each point:
- **none** (gray) — no coverage found
- **partial** (amber) — mentioned or touched on, lacking depth
- **good** (blue) — explained with reasonable depth, minor gaps
- **complete** (green) — thoroughly covered with depth, examples, and connections

### 7.5 Link Discovery
During generation and refresh, AI automatically scans all knowledge neurons in the brain, matches bullet points to relevant neurons based on content similarity, and attaches neuron IDs. Links are read-only references.

### 7.6 Real-Time Updates
- Cluster creation and topic generation are async operations
- SSE endpoint pushes events (`cluster-ready`, `topic-generated`, `topic-updated`, `topic-error`) to the frontend
- Frontend subscribes via `useResearchSse` hook for live progress updates

### 7.7 Status Flow
- **Cluster status:** `generating` (research goal being generated) → `ready`
- **Topic status:** `generating` (initial creation) → `ready` | `updating` (re-scoring) → `ready` | `error`

## 8. Tagging

### 8.1 Neuron Tags
- Tags are globally unique by name, with optional hex color
- Many-to-many relationship between neurons and tags
- Add/remove tag from neuron is idempotent
- Tags searchable by name (case-insensitive contains)
- Deleting a tag cascades to remove all neuron and brain associations

### 8.2 Brain Tags
- Brains can also be tagged using the same global tag set
- Many-to-many relationship via `brain_tags` join table
- Used for filtering in thoughts and search

## 9. Favorites & Pinning

- **Favorite:** Toggle `isFavorite` flag on a neuron; favorites listed on dashboard and dedicated `/favorites` page
- **Pin:** Toggle `isPinned` flag on a neuron; pinned neurons shown prominently on dashboard
- Both are toggle endpoints (flip the current boolean value)

## 10. Complexity Metadata

- Each neuron can be assigned a complexity level: **simple**, **moderate**, or **complex** (or null)
- Displayed as a color-coded badge on neuron cards in cluster view and graph view
- Editable via dropdown on the neuron editor page
- Brain stats aggregate complexity distribution

## 11. File Attachments

- Files uploaded via multipart form to MinIO object storage
- Stored with UUID-prefixed key: `{uuid}/{original-filename}`
- Metadata (filename, path, size, content type) saved in `attachments` table
- Download returns binary file with appropriate content type
- Delete removes from both MinIO and database
- Maximum upload size: 50MB

## 12. Templates

- Reusable content structures stored as TipTap JSON
- Templates have a name, optional description, and `contentJson`
- Can be associated with neurons via `templateId` field
- Full CRUD operations for template management

## 13. Neuron Links

- Directed connections between neurons with optional metadata
- Each link has: source neuron, target neuron, label (human-readable), link type (category like "references", "depends-on", "calls", "contains"), weight (connection strength), and source origin (`manual` or `editor`)
- **Wiki-link sync:** When neuron content is saved, `syncEditorLinks()` parses `contentJson` for `wikiLink` nodes, diffs against existing `source='editor'` links, and creates/deletes links accordingly. Manually created links (`source='manual'`) are never touched by the sync.
- Unique constraint prevents duplicate source→target links
- Links viewable in the **Connections Panel** on the neuron editor:
  - Incoming links (neurons that link TO this neuron)
  - Outgoing links (neurons this neuron links TO)
  - Each link shows target/source neuron title, label, and type
  - Click to navigate to linked neuron
- "Add Link" with autocomplete neuron search
- Links are used as edges in the knowledge graph visualization
- **Link Suggestions:** AI-powered link recommendations appear in the Connections Panel
  - **Reference suggestions:** Automatically extracted from wiki-link `[[` references in neuron content
  - **Related-to suggestions:** Based on vector embedding similarity (cosine distance) between neurons
  - Suggestions can be accepted (creates a real NeuronLink) or dismissed
  - Embeddings are computed asynchronously via the intelligence service when neuron content is saved
  - Uses pgvector with HNSW indexing for efficient similarity search

## 14. Knowledge Graph

- Visual network representation of neurons and their links within a brain
- Accessible via `/brain/[brainId]/graph`
- ReactFlow canvas with automatic Dagre hierarchical layout
- Neurons rendered as nodes, NeuronLinks rendered as directed edges
- Nodes grouped and color-coded by cluster (20 predefined colors)
- Edge styles differentiated by link type (dotted, dashed, solid lines with colors)
- Click node to open detail panel showing title, tags, and connections
- Double-click node to navigate to neuron editor
- Zoom controls, pan, and fit-view

## 15. Thoughts

Thoughts are tag-based filtered views that dynamically aggregate neurons matching specified criteria.

- **Name and description** — human-readable identifier and explanation
- **Neuron tag criteria** — select one or more neuron tags with matching mode:
  - `any` — neuron must have at least one of the selected tags (OR)
  - `all` — neuron must have all selected tags (AND)
- **Brain tag criteria** (optional) — filter to neurons in brains matching selected brain tags:
  - `any` — brain must have at least one of the selected tags (OR)
  - `all` — brain must have all selected tags (AND)
- At least one neuron tag is required
- **Neuron viewer** — displays matching neurons inline with content rendering
- **Keyboard navigation** — arrow keys (left/right) to navigate between matching neurons
- Full CRUD for thought management

## 16. Reminders

- Each neuron can have **multiple reminders**, up to a configurable limit (`maxRemindersPerNeuron` in settings, default 10, range 1–100)
- Reminder panel displays count and max (e.g., "Reminders 2/10")
- **Reminder types:**
  - `ONCE` — triggers once at the specified time, then deactivates
  - `RECURRING` — triggers repeatedly based on recurrence pattern
- **Recurrence patterns:** `DAILY`, `WEEKLY`, `MONTHLY`
- **Recurrence interval:** 1–365 (e.g., every 2 weeks, every 3 months)
- Each reminder can be independently edited or deleted
- Backend scheduled service:
  - Periodically scans for reminders whose `triggerAt` has passed
  - Creates a notification record with neuron context (title, brain/cluster IDs)
  - For recurring reminders: advances `triggerAt` by the recurrence interval
  - For one-time reminders: sets `isActive = false`

## 17. Notifications

- Generated by the reminder processing system
- Denormalized for frontend navigation (includes brainId, clusterId, neuronTitle)
- Frontend:
  - Bell icon with unread count badge
  - Dropdown listing recent notifications
  - Click notification to navigate directly to the related neuron
  - Mark individual as read / mark all as read
  - Polling every 30 seconds (pauses when browser tab is hidden to conserve resources)

## 18. Full-Text Search

- PostgreSQL-native full-text search using tsvector/tsquery
- GIN indexes on both `neurons.content_text` and `neurons.title` columns
- Supports optional filtering by `brainId`, `clusterId`, `neuronTagIds`, and `brainTagIds`
- Paginated results with `page` and `size` parameters
- Returns matching neurons with total count, plus per-result metadata: text highlight, relevance rank, brain name, and cluster name

## 19. Dashboard

Three sections displayed on the home page (`/`):
1. **Pinned neurons** — neurons with `isPinned = true`
2. **Favorite neurons** — neurons with `isFavorite = true`
3. **Recent neurons** — last 10 neurons ordered by `lastEditedAt` descending

Each neuron links directly to its editor page.

## 20. Brain Statistics

Brain overview page displays aggregated statistics:
- **Counts:** clusters, neurons, tags, links
- **Complexity distribution:** number of simple, moderate, and complex neurons
- **Most connected neurons:** neurons with the highest link count (with titles and cluster info)
- **Recently edited neurons:** most recently modified neurons (with titles and timestamps)

## 21. Import / Export

### 21.1 Export
- Export a complete brain as a JSON document
- Includes: brain metadata, all clusters, all neurons (with content, tags, favorites, pins), all tags (with colors), all neuron links (with labels, types, weights)
- Versioned format (`"version": "1.0"`)

### 21.2 Import
- Import a brain from a JSON document matching the export format
- Creates brain, clusters, neurons, tags, and links in a single transaction
- Tags are matched by name (reuses existing tags if names match)

## 22. Settings

- **Display name** — configurable user display name stored in `app_settings` (singleton row). Used as `createdBy` and `lastUpdatedBy` values when creating or editing brains, clusters, and neurons.
- **Max reminders per neuron** — configurable limit (1–100, default 10) controlling how many reminders can be created per neuron.
- Settings page accessible from sidebar navigation

## 23. Entity Audit Trail

- Brains, clusters, and neurons track `createdBy` and `lastUpdatedBy` fields
- Values are set from the current display name in app settings
- Displayed on the neuron editor page metadata section

## 24. Navigation

- **Sidebar** — primary navigation with expandable brain/cluster list (icons indicate cluster type), thoughts section, and links to search/favorites/trash/settings
- **Resizable sidebar** — drag-to-resize handle on the right edge, width range 200px–480px
- **Breadcrumb** — navigation trail on cluster and neuron pages (`Brain > Cluster > Neuron`)
- **Deep linking** — full URL support: `/brain/{brainId}/cluster/{clusterId}/neuron/{neuronId}`
- **Command palette** (`Ctrl+Shift+P`) — global command launcher for navigation, brain switching, theme toggle, and actions
- **Keyboard shortcuts:**
  - `Ctrl+K` — open search
  - `Ctrl+Shift+F` — global search (focus)
  - `Ctrl+N` — new neuron (on cluster page)
  - `Ctrl+S` — force save / create snapshot
  - `Ctrl+\` — toggle sidebar
  - `Ctrl+Shift+P` — command palette
  - `Ctrl+Shift+O` — toggle table of contents
  - `Ctrl+[` / `Ctrl+]` — previous / next neuron
  - `Alt+1–9` — switch to brain by index
  - `Escape` — go back / close panels
  - `?` — show keyboard shortcuts help dialog
  - Arrow keys — navigate neuron lists (in thought viewer)

## 25. Theming

- Dark and light mode support via `next-themes`
- Theme toggle in sidebar
- Preference persisted in browser localStorage

## 26. Responsive Design

- Mobile-friendly layout with collapsible sidebar
- Sidebar auto-collapses on small screens
- Touch-friendly controls and spacing

## 27. Spaced Repetition

SM-2 algorithm-based review scheduling for neurons, enabling long-term retention of knowledge.

- **Add/remove:** Any neuron can be added to or removed from the spaced repetition queue (one SR item per neuron)
- **Review queue:** `/review` page shows items due for review (`nextReviewAt <= now`)
- **Review flow:**
  1. Neuron title is shown
  2. User clicks "Show Content" to reveal the full neuron
  3. User rates recall quality:
     - **Again** (quality 1) — complete blackout, resets interval to 1 day
     - **Hard** (quality 2) — recalled with significant difficulty
     - **Good** (quality 4) — recalled correctly with some effort
     - **Easy** (quality 5) — perfect recall
  4. Auto-advances to next item
- **SM-2 algorithm:**
  - Quality >= 3: intervals progress 1 day → 6 days → (interval * easeFactor)
  - Quality < 3: resets to 1 day interval, resets repetition count
  - Ease factor adjusts per review: `ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))`, minimum 1.3
- **Sidebar badge:** Review link shows count of items due for review
- **Initial values:** easeFactor = 2.5, intervalDays = 0, repetitions = 0
- **Review Questions (Q&A mode):**
  - AI-generated question-answer pairs per neuron for active recall testing
  - Configurable `questionCount` per SR item (default 5)
  - Toggle `quizEnabled` per item to switch between Q&A mode and full-note review
  - Questions are cached and invalidated via content hash — only regenerated when neuron content changes
  - Questions are generated by the intelligence service's review-qa-generator agent
  - Requires substantive neuron content (min 100 chars with text-bearing sections)

## 28. Neuron Sharing

Token-based read-only sharing of individual neurons with optional expiration.

- **Share dialog** on neuron editor page allows generating share links
- **Expiry options:** 1 hour, 24 hours, 7 days, 30 days, or never
- **Token:** 64-character random hex string (32 bytes via SecureRandom)
- **Public URL:** `/shared/{token}` — accessible without authentication
- **Shared view** displays:
  - Neuron title, brain name, creation date, tags
  - Full content rendered in read-only view mode
  - Footer: "Shared via BrainBook"
- **Expired/invalid tokens** show error message: "This share link is invalid or has expired."
- **Revoke:** share links can be revoked from the share dialog
- **Multiple shares:** a neuron can have multiple active share links simultaneously

## 29. Markdown Export

Export neurons and brains as markdown documents.

- **Single neuron:** exported as a `.md` file with converted content
- **Full brain:** exported as a `.zip` file organized by cluster directories (`{clusterName}/{neuronTitle}.md`)
- **Supported conversions:**
  - Rich text sections: headings, paragraphs, lists (bullet, ordered), blockquotes, code blocks, horizontal rules, bold, italic, strikethrough, links
  - Code sections: fenced code blocks with language annotation
  - Math sections: LaTeX wrapped in `$$` delimiters
  - Diagram sections: Mermaid wrapped in fenced code blocks
  - Callout sections: blockquoted with type prefix

## 30. Table of Contents

- Auto-generated from H1, H2, and H3 headings in rich-text sections
- Toggle visibility via `Ctrl+Shift+O` or command palette
- Indentation by heading level for visual hierarchy
- Active heading highlighted based on scroll position (IntersectionObserver)
- Click to smooth-scroll to heading

---

## Non-Functional Requirements

### Data Integrity
- **Optimistic locking** on neuron content prevents concurrent edit data loss (409 Conflict on version mismatch)
- **Unique constraints** enforce data consistency (e.g., one SR item per neuron, no duplicate neuron links, unique tag names, unique share tokens)
- **Cascade deletes** ensure referential integrity when parent entities are removed
- **Transactional imports** ensure brain import is atomic (all-or-nothing)

### Performance
- **Full-text search** via PostgreSQL GIN index on `content_text` for sub-second query times
- **Lazy-loaded editors** (Code/Math/Diagram sections) to minimize initial page bundle size
- **Debounced auto-save** (1.5s) to batch rapid edits into single API calls
- **Notification polling pauses** when browser tab is hidden to reduce unnecessary network traffic
- **Partial indexes** on `is_archived` columns for efficient filtered queries

### Resilience
- **API client retry logic** — automatic 1 retry on 5xx server errors
- **15-second request timeout** to prevent hanging requests
- **Graceful error handling** — save status indicator shows errors; user can retry

### Storage
- **Dual content format** — JSON for rendering, plain text for search indexing
- **MinIO object storage** for file attachments with UUID-prefixed keys to prevent collisions
- **50MB maximum upload size** per file

### Deployment
- **Standalone Next.js output** for Docker containerization
- **Flyway migrations** auto-run on backend startup for zero-downtime schema updates
- **Docker Compose** configurations for infrastructure-only, full-stack, and production deployments
- **TestContainers** for backend tests ensure test environment matches production database

---

## 31. Project Cluster

Code-anchored knowledge system for exploring read-only codebases with IDE-level navigation while attaching neurons to specific file locations. Comprehensive specification in `06-project-cluster.md`.

- **Two modes:** URL Browse (GitHub API, default) and Sandbox (server-side git clone)
- **Neuron anchors:** Link neurons to specific file locations with line ranges and content hashing
- **Anchor reconciliation:** Automatic re-matching on git pull (hash check → exact search → fuzzy LCS)
- **Code intelligence:** File structure, go-to-definition, find references (via tree-sitter in intelligence service)
- **Git operations:** Pull, branch switch, log, blame, diff (sandbox mode, via JGit)
- **Sandbox management:** Provision, terminate, retry; lifecycle tracking; stale cleanup scheduler

## 32. AI Section Authoring

AI-assisted content generation for neuron sections. See `07-ai-service.md` for full protocol.

- Multi-turn conversation: agent can ask clarifying questions before generating content
- Supports rich-text, code, math, diagram, callout, and table section types
- Backend enriches request with neuron context (title, brain name, tags, sibling sections)
- Regenerate and undo capabilities

---

## Future Enhancements

The following features are under consideration but not yet implemented:

- **Cluster-level AI features** — gap analysis, summaries, organization suggestions, study guides (see `specs/future/intelligence-features.md`)
- **Layered/hierarchical graph view** — graph nodes grouped into collapsible cluster boxes, with drill-down navigation and cross-cluster edge summaries
- **Node focus mode** — in graph view, highlight a selected node and dim all unrelated nodes, showing only direct connections
