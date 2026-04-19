# Todo Cluster

Lightweight task management within BrainBook. Todo items are neurons with additional metadata (due date, priority, effort, completion status). Auto-reminders fire daily at 7pm local time for overdue tasks.

## Cluster Behavior

- **Type:** `todo` — unique per brain (only one non-archived todo cluster allowed)
- **Name:** Auto-set to "Tasks" — no user name input required
- **Sort order:** Displayed first in brain page and sidebar, before ai-research and knowledge clusters
- **Icon:** `CheckSquare` (lucide-react)

### Creation Paths

1. **Dialog:** Brain page → "New Cluster" → select "Todo List" type → creates "Tasks" cluster
2. **From neuron:** On any knowledge neuron → click `ListTodo` icon → opens `TasksPanel` sidebar → create tasks that auto-link back to the source neuron. If no todo cluster exists, one is auto-created.

## TodoMetadata

Stored in `todo_metadata` table (one-to-one with neuron via shared primary key).

| Field | Type | Description |
|-------|------|-------------|
| `dueDate` | DATE | Task deadline (date only). Setting this triggers auto-reminder creation. |
| `completed` | BOOLEAN | Whether task is done. Default: false. |
| `completedAt` | TIMESTAMPTZ | Auto-set when `completed` transitions to true; cleared on false. |
| `effort` | STRING | Estimated effort: `15min`, `30min`, `1hr`, `2hr`, `4hr`, `8hr`, or null. |
| `priority` | STRING | Priority: `critical`, `important`, `normal` (default). |

## Auto-Reminder System

When a todo's `dueDate` is set and the task is not completed, a **RECURRING DAILY** system reminder is created at 7pm in the user's configured timezone (`AppSettings.timezone`).

- **Reminder flag:** `isSystem = true` — distinguishes from user-created reminders
- **Title:** `"Task due: {neuron title}"`
- **Lifecycle:**
  - `dueDate` set → create or update system reminder with `triggerAt` = next 7pm local
  - `dueDate` cleared → deactivate system reminder
  - Task completed → deactivate system reminder
  - Task uncompleted → reactivate if `dueDate` exists
- **Visibility:** System reminders are excluded from `GET /api/reminders` (the reminders page)
- **Processing:** Handled by existing `ReminderSchedulerService` (polls every 60s) and `ReminderProcessingService` (creates notifications, advances recurring triggers)

The `TodoReminderService` manages system reminders directly via `ReminderRepository`, bypassing the `ReminderService.applyRequest()` validation (which requires `triggerAt` in the future — not applicable for already-overdue tasks).

## Frontend Components

### TodoClusterView (`components/todo/TodoClusterView.tsx`)

Main view for the todo cluster page. Props: `{ cluster, brainId }`.

- **Quick-add bar:** Text input + Enter → creates neuron + todo metadata with defaults
- **Show/hide completed toggle:** Default: completed tasks hidden. Button shows count: "Show completed (N)"
- **Sort order:** Incomplete first → due date ascending (nulls last) → priority (critical > important > normal)
- **Delete:** Each task row has a trash icon (visible on hover) with confirmation dialog

### TodoTaskRow (`components/todo/TodoTaskRow.tsx`)

Individual task row in the cluster list.

- Completion checkbox (Circle → CircleCheck toggle)
- Title as link to neuron page (strikethrough when completed)
- Priority badge: red for critical, orange for important, hidden for normal
- Effort pill: "15m", "30m", "1h", "2h", "4h", "8h"
- Due date badge: red if overdue, yellow if today, muted otherwise. Shows relative text: "Today", "Tomorrow", "2d", "3d overdue", "Jun 15"
- Delete button (trash icon, visible on hover)

### TodoMetadataEditor (`components/todo/TodoMetadataEditor.tsx`)

Compact metadata bar shown above the title on todo neuron pages.

- Completion checkbox
- Date picker for due date
- Priority dropdown (Critical / Important / Normal)
- Effort dropdown (— / 15 min / 30 min / 1 hr / 2 hr / 4 hr / 8 hr)
- Completed-at display when applicable
- Each change saves immediately via `PATCH /api/neurons/{id}/todo`

### TaskOverviewRow (`components/todo/TaskOverviewRow.tsx`)

Compact row rendered by the Task Overview page. Differs from `TodoTaskRow` by showing the brain/cluster context instead of the per-task delete action.

- Completion checkbox
- Title with link to the neuron editor
- Second line: brain color dot + `"{brain name} · {cluster name}"`
- Priority badge (hidden for normal)
- Effort pill
- Due date badge with the same overdue/today coloring used in `TodoTaskRow`

### TasksPanel (`components/todo/TasksPanel.tsx`)

Sidebar panel shown on knowledge neuron pages when the `ListTodo` toolbar button is clicked.

- **Quick-add input:** Create a new task linked to the current neuron
- **Task list:** Shows all tasks linked from this neuron (outgoing links with `linkType = "task"`)
- **Inline editing:** Each task card shows completion checkbox, title (link), and editable metadata (due date, priority, effort)
- **Delete:** Trash icon per task with confirmation

## Neuron Page Behavior

When `cluster.type === "todo"`:
- **Hidden toolbar buttons:** Reminder (Bell), Spaced Repetition (GraduationCap), History, Table of Contents (List), Share (Share2), Export (Download)
- **Visible toolbar buttons:** View/Edit toggle, Favorite (Star), Pin
- **Hidden:** Connections button (Link2) — tasks don't use the generic link system
- **Added:** `TodoMetadataEditor` bar above the title

When `cluster.type !== "todo"`:
- **Added:** `ListTodo` button in toolbar → toggles `TasksPanel` sidebar
- All standard buttons remain visible

## Sidebar Behavior

- **Icon:** `CheckSquare` for todo clusters (instead of `FolderOpen`)
- **Sort:** Todo clusters appear first, then ai-research, then others by sortOrder
- **Expanded view:** When the todo cluster is expanded in the sidebar, completed tasks are filtered out (uses `useTodoClusterMetadata` to check completion status)
- **Tasks link:** A global `Tasks` link (CheckSquare icon) sits directly under `Review` in both the expanded and collapsed sidebar, routing to `/tasks`

## Task Overview Page (`/tasks`)

Cross-brain view of every active task. Unlike `TodoClusterView` (which is scoped to a single cluster), this page aggregates tasks from every non-archived todo cluster across every brain.

- **Data source:** `useAllTasks()` → `GET /api/tasks` (returns `TaskOverviewItem[]` already joined with brain + cluster context)
- **Sort order** (client-side, `lib/taskSort.ts`):
  1. Incomplete first, completed last
  2. Effective due date ascending — **overdue tasks collapse to "yesterday"** so they always lead; tasks without a due date rank last
  3. Priority (critical → important → normal)
  4. Effort (15min → 8hr; tasks without effort rank after tasks with effort)
- **Rows:** `TaskOverviewRow` shows the brain/cluster context inline
- **Actions:** Toggle completion (same PATCH as elsewhere); clicking the title navigates to the neuron editor. Deletion is intentionally left to the cluster view.
- **Show/Hide completed toggle** with count

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/neurons/{neuronId}/todo` | Get or create todo metadata |
| PATCH | `/api/neurons/{neuronId}/todo` | Update todo metadata (triggers reminder sync) |
| GET | `/api/clusters/{clusterId}/todo` | Batch metadata for cluster list view |
| POST | `/api/brains/{brainId}/tasks` | Create task from neuron (auto-creates cluster + link) |
| GET | `/api/tasks` | List every active task across all brains with brain/cluster context (used by `/tasks`) |

## Backend Services

| Service | Responsibility |
|---------|---------------|
| `TodoMetadataService` | CRUD for todo metadata, delegates reminder sync |
| `TodoReminderService` | Creates/updates/deactivates system reminders based on metadata changes |
| `TodoService` | Orchestrates "create task from neuron" flow (find/create cluster, create neuron, create metadata, create link) |
| `TodoController` | REST endpoints for all todo operations |

## Database

Migration: `V33__add_todo_cluster_type.sql`

- Updates cluster type CHECK constraint to include `todo`
- Adds `timezone` column to `app_settings`
- Adds `is_system` column to `reminders`
- Creates `todo_metadata` table with indexes on `completed` and `due_date`
