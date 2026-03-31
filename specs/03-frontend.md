# Frontend Specification

## Technology Stack

| Technology            | Version | Purpose                              |
|-----------------------|---------|--------------------------------------|
| Next.js               | 16      | App Router framework                 |
| React                 | 19      | UI library                           |
| TypeScript            | 5.9     | Language                             |
| Tailwind CSS          | 4.2     | Styling                              |
| Radix UI              | —       | Accessible UI primitives             |
| TipTap                | 3.20    | Rich text editor                     |
| Monaco Editor         | 4.7     | Code editing (sections)              |
| ReactFlow             | 12      | Knowledge graph visualization        |
| Dagre                 | 3       | Hierarchical graph layout            |
| KaTeX                 | 0.16    | Math/LaTeX rendering                 |
| Mermaid               | 11      | Diagram rendering                    |
| Lucide React          | —       | Icons                                |
| next-themes           | —       | Dark/light mode                      |
| Vitest                | —       | Test runner                          |
| React Testing Library | —       | Component testing                    |
| MSW                   | —       | API mocking for tests                |

## Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Pinned, favorite, and recent neurons |
| `/search` | Search | Full-text search with tag filtering |
| `/favorites` | Favorites | All favorited neurons |
| `/trash` | Trash | Soft-deleted neurons with restore/permanent delete |
| `/settings` | Settings | Display name configuration |
| `/thoughts` | Thoughts | List of thought collections |
| `/thoughts/[thoughtId]` | Thought Viewer | View neurons matching thought criteria with keyboard navigation |
| `/review` | Review Queue | Spaced repetition review with quality ratings |
| `/shared/[token]` | Shared Neuron | Read-only public view of a shared neuron |
| `/brain/[brainId]` | Brain | Brain overview with stats, clusters, knowledge graph link |
| `/brain/[brainId]/graph` | Knowledge Graph | Visual network of neurons and links |
| `/brain/[brainId]/cluster/[clusterId]` | Cluster | List neurons with tags and complexity |
| `/brain/[brainId]/cluster/[clusterId]/neuron/[neuronId]` | Neuron Editor | Section-based content editor |

## Pages

### Dashboard (`/`)

Displays three sections:
1. **Pinned neurons** — shown if any neurons are pinned
2. **Favorite neurons** — shown if any neurons are favorited
3. **Recent neurons** — last 10 neurons ordered by `lastEditedAt`

Each neuron renders as a clickable link to the editor page, showing title and `lastEditedAt` date.

### Brain Page (`/brain/[brainId]`)

- Displays brain name, description, and statistics (cluster/neuron/tag/link counts, complexity distribution, most connected neurons, recently edited)
- Lists clusters as clickable cards
- "New Cluster" button to create clusters
- Link to knowledge graph view

### Cluster Page (`/brain/[brainId]/cluster/[clusterId]`)

- Lists neurons with title, content preview (first 100 chars), `lastEditedAt`, tags, and complexity badge
- "New Neuron" button creates a neuron with title "Untitled" and navigates to the editor

### Neuron Editor Page (`/brain/[brainId]/cluster/[clusterId]/neuron/[neuronId]`)

Core editing experience with section-based content:

- **Title input** — text field, auto-saves on change via `PATCH /api/neurons/{id}`
- **View/Edit toggle** — switch between reading mode and editing mode
- **Section-based editor** — add, reorder (move up/down), and delete content sections
- **Auto-save** — debounced at 1.5 seconds after content changes, uses `PUT /api/neurons/{id}/content`
- **Save status indicator** — displays: idle, saving, saved, error
- **Favorite toggle** — star icon button
- **Pin toggle** — pin icon button
- **Complexity selector** — dropdown to set simple/moderate/complex
- **Connections panel** — view/manage incoming and outgoing neuron links with labels and types
- **History panel** — view revisions, preview specific versions, restore or delete snapshots
- **Reminder panel** — set one-time or recurring reminders; supports multiple reminders per neuron with count/max display
- **Share dialog** — generate read-only share links with configurable expiry (1hr, 24hr, 7 days, 30 days, never); copy link; revoke shares
- **Table of contents** — auto-generated from headings (H1–H3) in rich-text sections; toggle via Ctrl+Shift+O; highlights active heading on scroll
- **Spaced repetition toggle** — add/remove neuron from review queue
- **Export options** — export neuron as markdown file; print as PDF (browser print dialog)
- **Metadata display** — shows created by, creation date, last updated by, update date
- **Optimistic locking** — client tracks `versionRef`, sends `clientVersion` on save, handles `409 Conflict`

**Section types (9):**

| Type | Editor | Description |
|------|--------|-------------|
| Rich Text | TipTap | Full formatting toolbar (bold, italic, headings, lists, tables, links, images, etc.) |
| Code | Monaco | Syntax highlighting for 28+ languages, resizable, title/language selector |
| Math | KaTeX | LaTeX input with live rendered preview |
| Diagram | Mermaid.js | Flowcharts, sequence diagrams, and other Mermaid diagram types |
| Callout | Custom | Styled boxes in 4 variants: info, warning, tip, note |
| Table | Custom | Editable tables with add/remove rows and columns |
| Image | Custom | Upload or URL-based with paste support |
| Audio | MediaRecorder | File upload and built-in voice recording |
| Divider | — | Horizontal separator |

**Section management:**
- Add new sections between any existing sections (hover to reveal insert button)
- Move sections up/down to reorder
- Delete sections (with attachment cleanup for image/audio)
- Code, Math, and Diagram sections are lazy-loaded

**Content save flow:**
1. Load neuron via `GET /api/neurons/{id}`
2. Parse `contentJson` (v2 sections format) for rendering
3. On section changes, collect all sections into JSON + extract plain text
4. On save (debounced), send both formats to `PUT /api/neurons/{id}/content`
5. On success, update local version counter

### Knowledge Graph (`/brain/[brainId]/graph`)

- ReactFlow canvas showing neurons as nodes and NeuronLinks as edges
- Automatic Dagre hierarchical layout with clustered grouping option
- Cluster color coding (20 predefined colors)
- Edge styles differentiated by link type (dotted, dashed, solid lines with colors)
- Click node to open detail panel (title, tags, connections)
- Double-click to navigate to neuron editor
- Zoom controls, pan, fit-view

### Favorites Page (`/favorites`)

- Lists all favorited neurons as links to their editor pages
- Shows `lastEditedAt` for each

### Search Page (`/search`)

- Search input with submit
- Tag filter dropdowns (brain tags and neuron tags)
- Calls `GET /api/search?q={query}`
- Displays results as neuron links with context
- Shows "No results found" when empty

### Trash Page (`/trash`)

- Lists soft-deleted neurons
- Each neuron shows:
  - **Restore** button — calls `POST /api/neurons/{id}/restore-from-trash`
  - **Delete** button — calls `DELETE /api/neurons/{id}/permanent` (with confirmation dialog)

### Settings Page (`/settings`)

- **Display name** — text input field for user's display name
- **Max reminders per neuron** — number spinner (range 1–100, default 10)
- Saves via `PATCH /api/settings`

### Thoughts List Page (`/thoughts`)

- Lists all thoughts with name and description
- "New Thought" button opens creation dialog
- Each thought clickable to view matching neurons

### Thought Viewer Page (`/thoughts/[thoughtId]`)

- Displays neurons matching the thought's tag criteria
- Inline neuron viewer showing content
- Arrow key navigation (left/right) between neurons
- Edit/delete thought actions

### Review Queue Page (`/review`)

- Displays spaced repetition items due for review
- Shows progress indicator: `{current} / {total}`
- For each item:
  - Neuron title displayed
  - "Show Content" button reveals full neuron content
  - After revealing content, quality rating buttons appear:
    - **Again** (quality: 1, red) — complete blackout
    - **Hard** (quality: 2, orange) — recalled with difficulty
    - **Good** (quality: 4, blue) — recalled correctly
    - **Easy** (quality: 5, green) — perfect recall
- Auto-advances to next item after rating
- Shows "All caught up!" when queue is empty or all items reviewed

### Shared Neuron Page (`/shared/[token]`)

- Public page, no authentication required
- Displays shared neuron metadata: title, brain name, creation date, tags
- Renders full neuron content via SectionList in read-only view mode
- Error state: "This share link is invalid or has expired."
- Footer: "Shared via BrainBook"

## Layout & Navigation

### Sidebar (`components/layout/Sidebar.tsx`)

- **Brains section** — expandable list with nested clusters (hierarchical tree, recursive rendering); context menus for rename/delete on brains and clusters
- **Thoughts section** — list of thought collections
- **Navigation links** — Dashboard, Search, Favorites, Trash, Review (with queue count badge), Settings
- **Collapse toggle** — sidebar can be collapsed/expanded (Ctrl+\)
- **Theme toggle** — dark/light mode switch
- **New Brain** button

### Breadcrumb (`components/layout/Breadcrumb.tsx`)

- Navigation trail on cluster and neuron pages: `Brain Name > Cluster Name > Neuron Title`
- Each segment is clickable
- Shows full parent cluster chain for nested clusters

### Notifications (`components/notifications/NotificationBell.tsx`)

- Bell icon in layout header
- Badge showing unread notification count
- Dropdown listing recent notifications with neuron titles and messages
- Click notification to navigate to the related neuron
- Mark individual as read / mark all as read
- Polling every 30 seconds (pauses when browser tab is hidden)

### Command Palette (`components/CommandPalette.tsx`)

- Global command launcher triggered by `Ctrl+Shift+P`
- Searchable list of commands:
  - **Navigation:** Dashboard, Search, Favorites, Trash, Thoughts, Settings, Review Queue
  - **Brain navigation:** Jump to any brain or brain graph
  - **Actions:** Toggle sidebar, toggle table of contents, switch theme, create new brain

## API Client (`lib/api.ts`)

Generic fetch wrapper with resilience features:

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
```

**Core methods:**
- `api.get<T>(path)` — GET request
- `api.post<T>(path, body?)` — POST request
- `api.put<T>(path, body?)` — PUT request
- `api.patch<T>(path, body?)` — PATCH request
- `api.delete<T>(path)` — DELETE request
- `api.upload<T>(path, formData)` — multipart upload

**Sub-clients:**
- `api.neuronLinks` — `getForNeuron()`, `getForBrain()`, `create()`, `delete()`
- `api.thoughts` — `list()`, `get()`, `create()`, `update()`, `delete()`, `neurons()`
- `api.importExport` — `exportBrain()`, `importBrain()`
- `api.reminders` — `list()`, `create()`, `update()`, `delete()`
- `api.revisions` — `list()`, `get()`, `create()`, `restore()`, `delete()`
- `api.settings` — `get()`, `update()`
- `api.notifications` — `getAll()`, `getUnreadCount()`, `markAsRead()`, `markAllAsRead()`
- `api.spacedRepetition` — `addItem()`, `removeItem()`, `getItem()`, `getAllItems()`, `getQueue()`, `submitReview()`

**Resilience:**
- 15-second request timeout
- 1 automatic retry on 5xx server errors
- Returns parsed JSON or `undefined` for `204 No Content`
- Throws error with message on non-2xx responses

## Hooks

| Hook | State / Actions | Description |
|------|-----------------|-------------|
| `useBrains()` | `brains`, `loading`, `createBrain`, `updateBrain`, `deleteBrain`, `refetch` | CRUD brains, fetches on mount |
| `useClusters(brainId)` | `clusters`, `loading`, `createCluster`, `updateCluster`, `deleteCluster`, `refetch` | Clusters for a brain, re-fetches on brainId change |
| `useNeurons(clusterId)` | `neurons`, `loading`, `createNeuron`, `deleteNeuron`, `refetch` | Neurons in a cluster |
| `useNeuronHistory(neuronId)` | `revisions`, `loading`, `createRevision`, `restoreRevision`, `deleteRevision` | Revision management |
| `useNeuronLinks(neuronId)` | `links`, `loading`, `createLink`, `deleteLink` | Manage neuron connections |
| `useTags()` | `tags`, `loading`, `addTagToNeuron`, `removeTagFromNeuron`, `addTagToBrain`, `removeTagFromBrain` | Tag management for neurons and brains |
| `useThoughts()` | `thoughts`, `loading`, `createThought`, `updateThought`, `deleteThought` | CRUD thoughts |
| `useNotifications()` | `notifications`, `unreadCount`, `markAsRead`, `markAllAsRead` | Notification polling and management |
| `useSettings()` | `settings`, `loading`, `updateDisplayName`, `updateMaxReminders` | App settings (display name, max reminders) |
| `useSpacedRepetition()` | `queue`, `queueLoading`, `allItems`, `itemsLoading`, `addToReview`, `removeFromReview`, `submitReview`, `isInReview` | SM-2 spaced repetition management |
| `useNeuronShares(neuronId)` | `shares`, `loading`, `createShare`, `revokeShare` | Token-based neuron sharing |
| `useAudioRecorder()` | `isRecording`, `start`, `stop`, `audioBlob` | Audio recording via MediaRecorder API |
| `useAttachmentUpload()` | `uploading`, `upload` | File upload to backend with progress |
| `useDebounce(value, delay)` | `debouncedValue` | Debounce values (used for auto-save) |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open search |
| `Ctrl+Shift+F` | Global search (focus) |
| `Ctrl+N` | New neuron (on cluster page) |
| `Ctrl+S` | Force save / create snapshot |
| `Ctrl+\` | Toggle sidebar |
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+Shift+O` | Toggle table of contents |
| `Ctrl+[` | Previous neuron |
| `Ctrl+]` | Next neuron |
| `Alt+1–9` | Switch to brain by index |
| `Escape` | Go back / close panels |
| `?` | Show keyboard shortcuts help dialog |
| `Arrow Left/Right` | Navigate between neurons in thought viewer |

## Theming

- Dark and light modes via `next-themes`
- Theme toggle in sidebar
- Preference persisted in localStorage

## Responsive Design

- Mobile-friendly layout with collapsible sidebar
- Sidebar auto-collapses on small screens
- Touch-friendly interactions

## TypeScript Types (`types/index.ts`)

```typescript
interface Brain {
  id: string; name: string; description: string | null;
  icon: string | null; color: string | null;
  sortOrder: number; isArchived: boolean;
  createdBy: string; lastUpdatedBy: string;
  createdAt: string; updatedAt: string;
}

interface Cluster {
  id: string; brainId: string; name: string; parentClusterId: string | null;
  sortOrder: number; isArchived: boolean;
  createdBy: string; lastUpdatedBy: string;
  createdAt: string; updatedAt: string;
}

interface Neuron {
  id: string; brainId: string; clusterId: string; title: string;
  contentJson: string | null; contentText: string | null;
  templateId: string | null; sortOrder: number;
  isFavorite: boolean; isPinned: boolean;
  isArchived: boolean; isDeleted: boolean;
  version: number; complexity: string | null;
  createdBy: string; lastUpdatedBy: string;
  createdAt: string; updatedAt: string; lastEditedAt: string;
  tags?: Tag[];
}

interface Tag {
  id: string; name: string; color: string | null;
  createdAt: string; updatedAt: string;
}

interface Attachment {
  id: string; neuronId: string; fileName: string; filePath: string;
  fileSize: number | null; contentType: string | null; createdAt: string;
}

interface NeuronRevision {
  id: string; neuronId: string; revisionNumber: number;
  title: string | null;
  contentJson: string | null; contentText: string | null;
  createdAt: string;
}

interface NeuronLink {
  id: string; sourceNeuronId: string; sourceNeuronTitle: string;
  sourceNeuronClusterId: string | null;
  targetNeuronId: string; targetNeuronTitle: string;
  targetNeuronClusterId: string | null;
  label: string | null; linkType: string | null;
  weight: number; source: string; createdAt: string;
}

interface Template {
  id: string; name: string; description: string | null;
  contentJson: string | null; createdAt: string; updatedAt: string;
}

interface Thought {
  id: string; name: string; description: string | null;
  neuronTagMode: string; brainTagMode: string;
  sortOrder: number; createdAt: string; updatedAt: string;
  neuronTags: Tag[]; brainTags: Tag[];
}

interface Reminder {
  id: string; neuronId: string;
  reminderType: "ONCE" | "RECURRING";
  triggerAt: string;
  recurrencePattern: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  recurrenceInterval: number;
  isActive: boolean; createdAt: string; updatedAt: string;
}

interface Notification {
  id: string; reminderId: string | null;
  neuronId: string; brainId: string; clusterId: string;
  neuronTitle: string; message: string;
  isRead: boolean; createdAt: string;
}

interface AppSettings {
  displayName: string;
  maxRemindersPerNeuron: number;
  createdAt: string; updatedAt: string;
}

interface SpacedRepetitionItem {
  id: string; neuronId: string; neuronTitle: string;
  easeFactor: number; intervalDays: number; repetitions: number;
  nextReviewAt: string; lastReviewedAt: string | null;
  createdAt: string;
}

interface NeuronShare {
  id: string; token: string;
  expiresAt: string | null; createdAt: string;
}

interface SharedNeuron {
  title: string; contentJson: string | null;
  tags: Tag[]; brainName: string | null;
  createdAt: string;
}

interface SearchResultItem {
  neuron: Neuron; highlight: string | null;
  rank: number; brainName: string | null;
  clusterName: string | null;
}
```
