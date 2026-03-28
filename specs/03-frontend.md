# Frontend Specification

## Technology Stack

- **Framework:** Next.js 16 (App Router)
- **React:** 19
- **Language:** TypeScript 5.9
- **Styling:** Tailwind CSS 4.2
- **UI Primitives:** Radix UI
- **Rich Text Editor:** TipTap 3.20.5
- **Icons:** Lucide React
- **Testing:** Vitest + React Testing Library + MSW

## Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Pinned, favorite, and recent neurons |
| `/brain/[brainId]` | Brain | List clusters in a brain |
| `/brain/[brainId]/cluster/[clusterId]` | Cluster | List neurons in a cluster |
| `/brain/[brainId]/cluster/[clusterId]/neuron/[neuronId]` | Editor | Rich text neuron editor |
| `/favorites` | Favorites | All favorited neurons |
| `/search` | Search | Full-text search interface |
| `/trash` | Trash | Soft-deleted neurons with restore/permanent delete |

## Pages

### Dashboard (`/`)

Displays three sections:
1. **Pinned neurons** -- shown if any neurons are pinned
2. **Favorite neurons** -- shown if any neurons are favorited
3. **Recent neurons** -- last 10 neurons ordered by `lastEditedAt`

Each neuron renders as a clickable link to the editor page, showing title and `lastEditedAt` date.

### Brain Page (`/brain/[brainId]`)

- Fetches clusters via `useClusters(brainId)` hook
- "New Cluster" button prompts for a name, then calls `createCluster`
- Clusters displayed as clickable cards linking to the cluster page

### Cluster Page (`/brain/[brainId]/cluster/[clusterId]`)

- Fetches neurons via `useNeurons(clusterId)` hook
- "New Neuron" button creates a neuron with title "Untitled" and navigates to the editor
- Each neuron card shows: title, content preview (first 100 chars of `contentText`), `lastEditedAt`

### Editor Page (`/brain/[brainId]/cluster/[clusterId]/neuron/[neuronId]`)

Core editing experience:

- **Title input** -- text field, auto-saves on change via `PATCH /api/neurons/{id}`
- **TipTap editor** -- rich text editing with toolbar
- **Auto-save** -- debounced at 1.5 seconds after content changes, uses `PUT /api/neurons/{id}/content`
- **Save status indicator** -- displays: idle, saving, saved, error
- **Favorite toggle** -- star icon button, calls `POST /api/neurons/{id}/favorite`
- **Pin toggle** -- pin icon button, calls `POST /api/neurons/{id}/pin`
- **Optimistic locking** -- client tracks `versionRef`, sends `clientVersion` on save, handles `409 Conflict`

Content flow:
1. Load neuron via `GET /api/neurons/{id}`
2. Parse `contentJson` from string to JSON for TipTap
3. On editor update, receive JSON and plain text
4. On save, stringify JSON and send both formats to `PUT /api/neurons/{id}/content`
5. On success, update local version counter

### Favorites Page (`/favorites`)

- Fetches via `GET /api/neurons/favorites`
- Lists neurons as links to their editor pages
- Shows `lastEditedAt` for each

### Search Page (`/search`)

- Search input field with submit
- Calls `GET /api/search?q={query}`
- Displays results as neuron links
- Shows "No results found" when empty

### Trash Page (`/trash`)

- Fetches via `GET /api/neurons/trash`
- Each neuron shows:
  - **Restore** button -- calls `POST /api/neurons/{id}/restore-from-trash`
  - **Delete** button -- calls `DELETE /api/neurons/{id}/permanent` (with confirmation dialog)
- Neurons removed from list after action

## API Client (`lib/api.ts`)

Generic fetch wrapper:

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}
```

- Returns parsed JSON or `undefined` for `204 No Content`
- Throws error with message on non-2xx responses

## Hooks

### `useBrains()`
- **State:** `brains: Brain[]`, `loading: boolean`
- **Actions:** `createBrain(name, icon?, color?)`, `updateBrain(id, ...)`, `deleteBrain(id)`, `refetch()`
- Fetches on mount via `GET /api/brains`

### `useClusters(brainId: string | null)`
- **State:** `clusters: Cluster[]`, `loading: boolean`
- **Actions:** `createCluster(name)`, `updateCluster(id, name)`, `deleteCluster(id)`, `refetch()`
- Fetches on mount and when `brainId` changes; clears if `brainId` is null

### `useNeurons(clusterId: string | null)`
- **State:** `neurons: Neuron[]`, `loading: boolean`
- **Actions:** `createNeuron(title, brainId)`, `deleteNeuron(id)`, `refetch()`
- Fetches on mount and when `clusterId` changes; clears if `clusterId` is null

## Components

### TipTap Editor (`components/editor/TiptapEditor.tsx`)

**Props:**
- `content: Record<string, unknown> | null` -- initial TipTap JSON
- `onUpdate: (json: Record<string, unknown>, text: string) => void` -- called on every edit

**Extensions:**
- StarterKit (bold, italic, lists, code blocks, etc.)
- Underline
- Link (openOnClick: false)
- Image
- Table + TableRow + TableHeader + TableCell
- TaskList + TaskItem (nested: true)
- Placeholder ("Start writing...")
- Highlight (multicolor: true)
- CodeBlockLowlight (syntax highlighting)
- Typography (smart quotes, dashes)

### Toolbar (`components/editor/Toolbar.tsx`)

Formatting buttons grouped by category:
1. **Inline:** Bold, Italic, Underline, Strikethrough, Code, Highlight
2. **Block:** Headings (H1, H2, H3), Bullet List, Ordered List, Task List
3. **Insert:** Blockquote, Horizontal Rule, Table, Link, Image
4. **History:** Undo, Redo

Each button shows active state when the corresponding mark/node is active.

## TypeScript Types (`types/index.ts`)

```typescript
interface Brain {
  id: string; name: string; icon: string | null; color: string | null;
  sortOrder: number; isArchived: boolean; createdAt: string; updatedAt: string;
}

interface Cluster {
  id: string; brainId: string; name: string; parentClusterId: string | null;
  sortOrder: number; isArchived: boolean; createdAt: string; updatedAt: string;
}

interface Neuron {
  id: string; brainId: string; clusterId: string; title: string;
  contentJson: Record<string, unknown> | null; contentText: string | null;
  templateId: string | null; isArchived: boolean; isDeleted: boolean;
  isFavorite: boolean; isPinned: boolean; version: number;
  createdAt: string; updatedAt: string; lastEditedAt: string;
}

interface Tag {
  id: string; name: string; color: string | null; createdAt: string;
}

interface Attachment {
  id: string; neuronId: string; storageKey: string; filename: string;
  mimeType: string | null; sizeBytes: number | null; createdAt: string;
}

interface NeuronRevision {
  id: string; neuronId: string; revisionNumber: number;
  contentJson: Record<string, unknown> | null; contentText: string | null;
  createdAt: string; reason: string; snapshotName: string | null;
}

interface Template {
  id: string; name: string; description: string | null;
  contentJson: Record<string, unknown> | null; createdAt: string; updatedAt: string;
}
```
