# Project Cluster

## 1. Context & Use Cases

### 1.1 Overview

A Project cluster transforms BrainBook from a note-taking tool into a code-anchored knowledge system. Users explore read-only codebases with IDE-level navigation while attaching neurons (notes) to specific file locations. This creates a persistent knowledge graph rooted in source code — design rationale, learning annotations, and code understanding that survives across git history.

### 1.2 Use Cases

| Use Case | Description |
|----------|-------------|
| **Understanding vibe-coded apps** | Clone an AI-generated codebase, annotate confusing patterns, build a mental model neuron by neuron |
| **Development logging** | Track design decisions anchored to the exact code they affect; future self sees the "why" alongside the "what" |
| **Algorithm study** | Clone open-source algorithm libraries, annotate implementations with complexity analysis and alternative approaches |
| **Open-source study** | Explore large frameworks (Spring, React) with personal annotations linked to source code |

### 1.3 Core Concept

A Project cluster operates in one of two modes, determined by whether a sandbox has been provisioned:

- **URL Browse mode** (default) — user provides a git remote URL. Code is fetched on-demand via the hosting provider's API (GitHub API in V1). No server-side clone. Neurons can be anchored to lines but cannot be automatically re-matched on changes.
- **Sandbox mode** (explicit provisioning) — user clicks "Provision Sandbox" to clone the repo server-side. Enables full git operations (pull, branch switch, log, blame, diff), tree-sitter code intelligence, and automatic anchor reconciliation on pull.

Multiple Project clusters are allowed per brain (no per-brain limit).

---

## 2. Domain Model

### 2.1 Modified Entities

#### ClusterType (modified)

Remove `PROJECT` from the uniqueness check. The `uq_cluster_brain_project` partial unique index is dropped.

```java
public boolean isUnique() {
    return this == AI_RESEARCH; // PROJECT removed — multiple project clusters per brain allowed
}
```

#### Cluster (no schema change)

Project clusters use `type = 'project'` and `status = 'ready'` (no generation phase). The existing `researchGoal` column is unused for project clusters.

#### CreateClusterRequest (extended)

For project clusters, the creation request includes an optional `repoUrl` and `defaultBranch`:

```json
{
  "name": "spring-framework",
  "brainId": "uuid",
  "type": "project",
  "repoUrl": "https://github.com/spring-projects/spring-framework.git",
  "defaultBranch": "main"
}
```

The backend creates both the Cluster and its ProjectConfig in a single transaction.

### 2.2 New Entities

#### ProjectConfig

Per-cluster configuration for project features. One-to-one with Cluster (only for `type=project`).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| clusterId | UUID | NOT NULL, FK → clusters ON CASCADE, UNIQUE | Parent cluster |
| repoUrl | String(2000) | NOT NULL | Git remote URL (HTTPS) |
| defaultBranch | String(255) | nullable | Default branch to display (e.g., "main") |
| createdAt | LocalDateTime | NOT NULL, auto-set | Creation timestamp |
| updatedAt | LocalDateTime | NOT NULL, auto-updated | Last modification timestamp |

**Design note:** There is no `browseMode` column. The current mode is derived from sandbox existence — if a `sandboxes` row with `status = 'active'` exists for this cluster, it is in sandbox mode. Otherwise, URL browse mode.

#### NeuronAnchor

Links a neuron to a specific location in a file within a project cluster. Each neuron can have at most one anchor (UNIQUE on `neuron_id`). A neuron anchored to a line IS the annotation at that line. For cross-file annotations, create multiple neurons and link them via the existing NeuronLink entity.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| neuronId | UUID | NOT NULL, FK → neurons ON CASCADE, UNIQUE | Anchored neuron |
| clusterId | UUID | NOT NULL, FK → clusters ON CASCADE | Project cluster |
| filePath | String(1000) | NOT NULL | Relative file path from repo root |
| startLine | int | NOT NULL | Start line number (1-based) |
| endLine | int | NOT NULL | End line number (inclusive) |
| contentHash | String(64) | NOT NULL | SHA-256 hash of normalized anchored content |
| anchoredText | TEXT | NOT NULL | Verbatim copy of the anchored lines (for re-matching) |
| commitSha | String(40) | nullable | Commit SHA when anchor was created (null in URL-browse mode) |
| status | String(20) | NOT NULL, default 'active' | `active`, `drifted`, `orphaned` |
| driftedStartLine | int | nullable | Updated start line after fuzzy re-match (when status = drifted) |
| driftedEndLine | int | nullable | Updated end line after fuzzy re-match (when status = drifted) |
| createdAt | LocalDateTime | NOT NULL, auto-set | Creation timestamp |
| updatedAt | LocalDateTime | NOT NULL, auto-updated | Last modification timestamp |

**Constraints:**
- CHECK: `status IN ('active', 'drifted', 'orphaned')`
- CHECK: `start_line >= 1 AND end_line >= start_line`
- CHECK: `end_line - start_line <= 100` (max 100 lines per anchor to bound `anchoredText` size)
- UNIQUE(`neuron_id`) — one anchor per neuron

**Indexes:**
- `idx_neuron_anchors_cluster` on `cluster_id`
- `idx_neuron_anchors_file` on `(cluster_id, file_path)`
- `idx_neuron_anchors_neuron` on `neuron_id`
- `idx_neuron_anchors_non_active` partial index on `status` WHERE `status != 'active'`

### 2.3 Entity Relationships

```
Cluster (type=project)
    │
    ├── (1) ProjectConfig            one-to-one, project clusters only
    ├── (0..1) Sandbox               one-to-one, only when provisioned (see sandbox-management spec)
    ├── (*) Neuron                    standard neurons in the cluster
    └── (*) NeuronAnchor             anchors linking neurons to file locations
              │
              └── (1) Neuron         each anchor points to exactly one neuron
```

### 2.4 Flyway Migration: V26

```sql
-- V26__add_project_cluster_tables.sql

-- 1. Remove one-per-brain restriction for project clusters
DROP INDEX IF EXISTS uq_cluster_brain_project;

-- 2. Project configuration (one-to-one with cluster)
CREATE TABLE project_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id      UUID NOT NULL UNIQUE REFERENCES clusters(id) ON DELETE CASCADE,
    repo_url        VARCHAR(2000) NOT NULL,
    default_branch  VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Neuron anchors (links neurons to file locations)
CREATE TABLE neuron_anchors (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neuron_id          UUID NOT NULL UNIQUE REFERENCES neurons(id) ON DELETE CASCADE,
    cluster_id         UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    file_path          VARCHAR(1000) NOT NULL,
    start_line         INTEGER NOT NULL,
    end_line           INTEGER NOT NULL,
    content_hash       VARCHAR(64) NOT NULL,
    anchored_text      TEXT NOT NULL,
    commit_sha         VARCHAR(40),
    status             VARCHAR(20) NOT NULL DEFAULT 'active',
    drifted_start_line INTEGER,
    drifted_end_line   INTEGER,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT check_anchor_status CHECK (status IN ('active', 'drifted', 'orphaned')),
    CONSTRAINT check_anchor_lines CHECK (start_line >= 1 AND end_line >= start_line),
    CONSTRAINT check_anchor_max_lines CHECK (end_line - start_line <= 100)
);

CREATE INDEX idx_neuron_anchors_cluster ON neuron_anchors(cluster_id);
CREATE INDEX idx_neuron_anchors_file ON neuron_anchors(cluster_id, file_path);
CREATE INDEX idx_neuron_anchors_neuron ON neuron_anchors(neuron_id);
CREATE INDEX idx_neuron_anchors_non_active ON neuron_anchors(status) WHERE status != 'active';
```

---

## 3. Neuron Anchoring Model

### 3.1 Anchor Data

When a user creates a neuron anchored to a line range, the system captures:

1. **File path** — relative from repo root (e.g., `src/main/java/com/example/Foo.java`)
2. **Line range** — start and end line numbers (1-based, inclusive, max 100 lines)
3. **Content hash** — SHA-256 of the anchored lines' normalized text
4. **Anchored text** — verbatim copy of the anchored lines (used for re-matching)
5. **Commit SHA** — the commit at which the anchor was created (sandbox mode only; null for URL-browse)

### 3.2 Content Hash Normalization

To make the hash resilient to trivial whitespace changes:

```
normalize(text):
  1. Split into lines
  2. Trim trailing whitespace from each line
  3. Remove completely blank leading/trailing lines
  4. Join with \n
  5. SHA-256 hash the result
```

### 3.3 Anchor Status Lifecycle

```
                    ┌─────────┐
    create anchor──>│  active  │
                    └────┬────┘
                         │ git pull changes file
                         ▼
              ┌──── content hash check ────┐
              │                            │
         hash matches                hash differs
         (at original lines)               │
              │                            ▼
              ▼                   ┌── exact text search ──┐
        ┌─────────┐              │                        │
        │  active  │        found at                  not found
        │(no change│        new lines                     │
        │ needed)  │             │                        ▼
        └─────────┘              ▼                 ┌── fuzzy LCS ──┐
                           ┌─────────┐             │               │
                           │  active  │       similarity       not found
                           │(auto-    │       >= 0.7               │
                           │ updated) │            │               ▼
                           └─────────┘             ▼         ┌──────────┐
                                             ┌─────────┐    │ orphaned  │
                                             │ drifted │    └──────────┘
                                             └────┬────┘
                                                  │ user confirms
                                                  ▼
                                             ┌─────────┐
                                             │  active  │
                                             └─────────┘
```

**Key distinction:** When content moves but is byte-identical (exact text search finds it at new lines), the anchor auto-updates to `active` with new line numbers — no user confirmation needed. Only fuzzy matches (similar but not identical content) produce `drifted` status requiring user review.

### 3.4 Re-Matching Algorithm (on git pull, sandbox mode only)

When a git pull occurs, the server runs anchor reconciliation for all anchors in changed files (optimized via `git diff --name-only old_commit..new_commit`):

**Phase 1: Fast hash check**
1. Read the file at `filePath`, extract lines `startLine` to `endLine`
2. Compute SHA-256 of the normalized content
3. If hash matches `contentHash` → anchor is still valid, no change

**Phase 2: Exact text search (content shifted)**
1. Read entire file content
2. Search for the exact `anchoredText` (whitespace-normalized) anywhere in the file
3. If found at new line numbers → auto-update `startLine`/`endLine`/`contentHash`, keep status=`active`

**Phase 3: Fuzzy re-match (content modified)**
1. Use longest common subsequence (LCS) matching between `anchoredText` and each window of the same line count in the file
2. Score: `similarity = LCS_length / max(anchored_length, candidate_length)`
3. If best match has similarity >= 0.7 (configurable via `ANCHOR_FUZZY_THRESHOLD`):
   - Set `drifted` with `driftedStartLine`/`driftedEndLine`
   - UI shows "Content changed, review needed"
4. If no match meets threshold → set status to `orphaned`

**Phase 4: File-level checks**
- If file at `filePath` no longer exists, detect renames via `git diff --find-renames`
- If rename detected → update `filePath`, re-run phases 1-3
- If file truly deleted → set status to `orphaned`

### 3.5 Edge Cases

| Scenario | Behavior |
|----------|----------|
| File renamed | Detect via `git diff --find-renames`. Update anchor's `filePath`, re-run matching. |
| File deleted | Anchor becomes `orphaned`. |
| Content partially changed | Fuzzy match with LCS. If similarity >= 0.7, mark `drifted`. Otherwise `orphaned`. |
| Content moved to different file | Not detected in V1. Anchor becomes `orphaned`. User can manually re-anchor. |
| Multiple anchors on overlapping lines | Each neuron has its own independent anchor. All re-matched independently. |
| Branch switch | All anchors re-matched against the new branch's file state. |
| URL-browse mode | No automatic re-matching. Anchors are static; user must manually verify. |
| Identical content at multiple locations | First match (earliest in file) is used. |

### 3.6 Orphan Management

Orphaned and drifted neurons appear in a dedicated section in the neuron panel:

| Action | Description |
|--------|-------------|
| **Re-anchor** | User selects new file + line range; anchor is recreated with fresh hash |
| **Confirm drift** | Accept drifted position as new active anchor (drifted only) |
| **Dismiss** | Anchor is removed; neuron becomes unanchored (still exists in the cluster's neuron list) |
| **Delete neuron** | Remove both the anchor and the neuron |

---

## 4. API Endpoints

### 4.1 Project Cluster Lifecycle

Uses the existing cluster endpoints with `type: "project"`:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/clusters` | Create cluster with `type: "project"`, `repoUrl`, `defaultBranch` |
| PATCH | `/api/clusters/{id}` | Update cluster name |
| DELETE | `/api/clusters/{id}` | Delete cluster (cascades to config, anchors, sandbox) |

### 4.2 Project Config

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/clusters/{id}/project-config` | Get project configuration |
| PATCH | `/api/clusters/{id}/project-config` | Update config (defaultBranch) |

### 4.3 File Browsing — URL Browse Mode (GitHub API proxy)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/clusters/{id}/browse/tree?ref=&path=` | Directory listing via GitHub API |
| GET | `/api/clusters/{id}/browse/file?ref=&path=` | File content via GitHub API |
| GET | `/api/clusters/{id}/browse/branches` | List branches via GitHub API |

**V1 limitation:** URL browse mode supports GitHub repositories only. Other providers (GitLab, Bitbucket) require sandbox mode.

### 4.4 File Browsing — Sandbox Mode

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/clusters/{id}/sandbox/tree?path=` | Directory listing from local filesystem |
| GET | `/api/clusters/{id}/sandbox/file?path=` | File content from local filesystem |
| GET | `/api/clusters/{id}/sandbox/search?q=&regex=` | Full-text codebase search |

### 4.5 Git Operations (Sandbox Mode)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/clusters/{id}/sandbox/pull` | Pull latest, run anchor reconciliation |
| POST | `/api/clusters/{id}/sandbox/checkout` | Switch branch, run anchor reconciliation |
| GET | `/api/clusters/{id}/sandbox/branches` | List all branches |
| GET | `/api/clusters/{id}/sandbox/log?limit=50&offset=0` | Git commit log (paginated) |
| GET | `/api/clusters/{id}/sandbox/blame?path=` | Line-by-line blame |
| GET | `/api/clusters/{id}/sandbox/diff?from=&to=` | Diff between refs |

**Pull response** includes anchor reconciliation summary:
```json
{
  "newCommit": "abc123",
  "anchorsAffected": {
    "unchanged": 12,
    "autoUpdated": 2,
    "drifted": 1,
    "orphaned": 1
  }
}
```

### 4.6 Code Intelligence (Sandbox Mode)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/clusters/{id}/sandbox/structure?path=` | File symbol outline (tree-sitter) |
| GET | `/api/clusters/{id}/sandbox/definition?path=&line=&col=` | Go to definition |
| GET | `/api/clusters/{id}/sandbox/references?path=&line=&col=` | Find all references |

These proxy to the intelligence service (see section 6).

### 4.7 Neuron Anchors

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/neuron-anchors/cluster/{clusterId}?page=0&size=50` | List all anchors in cluster (paginated) |
| GET | `/api/neuron-anchors/cluster/{clusterId}/file?path=&page=0&size=50` | Anchors for a specific file (paginated) |
| GET | `/api/neuron-anchors/cluster/{clusterId}/orphaned` | List orphaned + drifted anchors |
| POST | `/api/neuron-anchors` | Create anchor for an existing neuron |
| PATCH | `/api/neuron-anchors/{id}` | Re-anchor (update file/lines) |
| DELETE | `/api/neuron-anchors/{id}` | Remove anchor (neuron becomes unanchored) |
| POST | `/api/neuron-anchors/{id}/confirm-drift` | Accept drifted position as new active anchor |

**Create anchor request:**
```json
{
  "neuronId": "uuid",
  "clusterId": "uuid",
  "filePath": "src/main/java/com/example/Foo.java",
  "startLine": 15,
  "endLine": 22
}
```

The server reads file content at the specified lines, computes `contentHash`, stores `anchoredText`, and captures `commitSha` (sandbox mode only).

### 4.8 Atomic Neuron + Anchor Creation

The neuron creation endpoint is extended with an optional `anchor` field for project clusters. Both are created in a single transaction:

```json
POST /api/neurons
{
  "title": "Bean resolution strategy",
  "brainId": "uuid",
  "clusterId": "uuid",
  "anchor": {
    "filePath": "src/main/java/com/example/BeanFactory.java",
    "startLine": 15,
    "endLine": 22
  }
}
```

If the `anchor` field is present, both the neuron and anchor are created atomically. If anchor creation fails (e.g., file not found, line out of range), the entire transaction rolls back.

---

## 5. UI Concept

### 5.1 Project Cluster Page Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Brain > ProjectCluster: spring-framework    main ▼  [Provision Sandbox]│
├──────────┬───────────────────────────────────────────┬───────────────────┤
│ FILE     │  CODE VIEWER                              │ NEURON PANEL      │
│ TREE     │                                           │                   │
│          │  src/main/.../BeanFactory.java             │ [+ New Neuron]    │
│ ▼ src/   │  ─────────────────────────────────────    │                   │
│   ▼ main/│  14                                       │ ┌───────────────┐ │
│     ...  │  15  public Object getBean(String n) { ◈ │ │ Bean Factory   │ │
│   ▼ test/│  16    return doGetBean(n, null);     │  │ │ Notes          │ │
│     ...  │  17  }                                │  │ │ Lines 15-22   │ │
│          │  18                                   │  │ │ Status: active│ │
│          │  19  @Override                        │  │ └───────────────┘ │
│          │  20  public <T> T getBean(Class<T> c) │  │                   │
│          │  21    return doGetBean(null, c);      │  │ ┌───────────────┐ │
│          │  22  }                                ◈  │ │ Type Resolver  │ │
│          │  23                                       │ │ Lines 45-52   │ │
│          │                                           │ └───────────────┘ │
│          │                                           │                   │
├──────────┤                                           │ ── Needs Review ─ │
│ STRUCTURE│                                           │ ┌───────────────┐ │
│          │                                           │ │ Old Impl Note │ │
│ ◆ Bean.. │                                           │ │ (drifted)     │ │
│   ○ get..│                                           │ │ [Confirm]     │ │
│   ○ get..│                                           │ └───────────────┘ │
└──────────┴───────────────────────────────────────────┴───────────────────┘
```

Key: `◈` = anchor indicator in gutter (line has attached neuron)

### 5.2 Sandbox Provisioned Layout

When sandbox is active, the header gains additional controls:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Brain > spring-framework    main ▼  [Pull] [Log] [Blame] [Terminate]  │
├──────────┬───────────────────────────────────────────┬───────────────────┤
│ ...      │  (same layout)                            │ ...               │
│          │  + blame annotations in gutter            │                   │
│          │  + Ctrl+Click go-to-definition            │                   │
│          │  + Ctrl+P quick open (all files)          │                   │
└──────────┴───────────────────────────────────────────┴───────────────────┘
```

### 5.3 Mode Capabilities Matrix

Features shown/hidden based on mode. Unavailable features show disabled buttons with tooltips.

| Feature | URL Browse | Sandbox |
|---------|-----------|---------|
| File tree | Yes (lazy-loaded via API) | Yes (local filesystem) |
| File viewing + syntax highlighting | Yes | Yes |
| Create/view neuron anchors | Yes | Yes |
| Quick open (Ctrl+P) | Loaded tree nodes only | All files (full search) |
| Branch selector | Yes (via GitHub API) | Yes (local checkout) |
| Git pull | No — "Provision sandbox to enable" | Yes |
| Git log / blame / diff | No — "Provision sandbox to enable" | Yes |
| Tree-sitter structure | No | Yes |
| Go-to-definition (Ctrl+Click) | No | Yes |
| Find references | No | Yes |
| Full-text search (Ctrl+Shift+F) | No | Yes |
| Automatic anchor reconciliation | No (anchors are static) | Yes (on pull/checkout) |

### 5.4 Component Breakdown

| Component | Location | Description |
|-----------|----------|-------------|
| `ProjectClusterView` | Main container | Three-panel layout; adapts controls based on sandbox existence |
| `FileTreePanel` | Left panel | Hierarchical file browser with expand/collapse, lazy loading |
| `CodeViewer` | Center panel | CodeMirror 6 read-only; syntax highlighting; anchor gutter markers |
| `NeuronPanel` | Right panel | Lists neurons for current file; orphan/drift section at bottom |
| `AnchorGutter` | CodeMirror gutter extension | Clickable markers showing which lines have anchored neurons |
| `CreateAnchorDialog` | Overlay | After selecting line range, enter neuron title; creates both atomically |
| `FileStructurePanel` | Bottom-left toggle | Symbol outline for current file (tree-sitter, sandbox only) |
| `QuickOpenDialog` | Overlay (Ctrl+P) | Fuzzy file search |
| `BranchSelector` | Header dropdown | Branch switching |
| `GitLogPanel` | Toggle panel | Commit history with author, date, message |
| `BlameView` | Inline gutter overlay | Per-line blame annotations |
| `DiffView` | Full panel | Side-by-side or unified diff |
| `OrphanList` | Neuron panel section | Orphaned/drifted anchors with re-anchor/confirm/dismiss actions |
| `SandboxStatusBar` | Footer | Sandbox status, current branch, last pull time |
| `ProvisionSandboxDialog` | Overlay | Sandbox provisioning options |

### 5.5 Code Viewer Details

The code viewer reuses the existing CodeMirror 6 setup (`web/src/components/editor/CodeMirrorEditor.tsx`) in read-only mode. Additional features:

- **Syntax highlighting** — via existing CodeMirror language extensions (17+ languages)
- **Line numbers** — standard gutter
- **Anchor gutter** — custom gutter extension: colored markers for anchored neurons, click to scroll neuron panel
- **Line selection** — click + drag to select a line range; toolbar button or right-click to create anchor
- **Go-to-definition** — Ctrl+Click on identifiers (sandbox mode; sends request to tree-sitter)
- **Blame annotations** — optional gutter showing commit info per line (sandbox mode)

### 5.6 Keyboard Shortcuts

| Shortcut | Action | Mode |
|----------|--------|------|
| `Ctrl+P` | Quick open (fuzzy file search) | Both (limited in URL mode) |
| `Ctrl+Shift+O` | Toggle file structure panel | Sandbox only |
| `Ctrl+G` | Go to line number | Both |
| `Ctrl+Click` | Go to definition | Sandbox only |
| `Ctrl+Shift+F` | Search in codebase | Sandbox only |
| `Escape` | Close overlay panels | Both |

---

## 6. Code Navigation (Tree-Sitter)

### 6.1 Architecture

Tree-sitter runs in the intelligence service (FastAPI/Python) where mature `tree-sitter` bindings are available. The Java backend proxies requests.

```
Frontend                   Java Backend              Intelligence Service
   │                           │                           │
   │ GET .../structure?path=   │                           │
   │──────────────────────────>│ POST /api/code/structure  │
   │                           │──────────────────────────>│
   │                           │  { content, language }    │
   │                           │<──────────────────────────│
   │<──────────────────────────│  { symbols: [...] }       │
```

**Latency consideration:** Go-to-definition should respond in <200ms. The intelligence service caches symbol indexes per file (invalidated on file change). On sandbox provision, all files are pre-indexed to warm the cache. If latency becomes unacceptable, tree-sitter JNI in the Java backend is the documented fallback path.

### 6.2 Intelligence Service Endpoints (New)

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/code/structure` | `{ content, language }` | `{ symbols: Symbol[] }` |
| POST | `/api/code/definition` | `{ content, language, line, col, projectFiles }` | `{ file, line, col }` |
| POST | `/api/code/references` | `{ content, language, symbolName, projectFiles }` | `{ references: Location[] }` |

### 6.3 Symbol Model

```json
{
  "symbols": [
    {
      "name": "BeanFactory",
      "kind": "interface",
      "startLine": 3,
      "endLine": 7,
      "children": [
        { "name": "getBean", "kind": "method", "startLine": 4, "endLine": 4, "children": [] },
        { "name": "containsBean", "kind": "method", "startLine": 6, "endLine": 6, "children": [] }
      ]
    }
  ]
}
```

### 6.4 Supported Languages (V1)

Java, Python, TypeScript, JavaScript, Go, Rust, C, C++, Ruby, PHP, Kotlin, Swift, SQL, HTML, CSS, JSON, YAML, Markdown, Shell/Bash.

Tree-sitter has grammars for 100+ languages — others can be added incrementally.

---

## 7. Git Operations

All git operations are read-only. No push, commit, or write operations to the remote. Implemented using JGit (pure Java, no git CLI dependency).

### 7.1 Operations

| Operation | Endpoint | Behavior |
|-----------|----------|----------|
| **Pull** | `POST .../sandbox/pull` | `git pull origin <branch>`. Runs anchor reconciliation. Returns summary. |
| **Switch branch** | `POST .../sandbox/checkout` | `git checkout <branch>`. Runs anchor reconciliation. |
| **Log** | `GET .../sandbox/log` | Paginated commit history: SHA, author, date, message. |
| **Blame** | `GET .../sandbox/blame?path=` | Per-line: commit SHA, author, date, content. |
| **Diff** | `GET .../sandbox/diff?from=&to=` | Unified diff between two refs. |
| **Branches** | `GET .../sandbox/branches` | Local + remote branch names. |

### 7.2 Pull + Anchor Reconciliation Flow

```
POST /api/clusters/{id}/sandbox/pull
    │
    ├── 1. git pull origin <current_branch>
    │
    ├── 2. Update sandbox: currentCommit, lastPulledAt
    │
    ├── 3. Get changed files: git diff --name-only old_commit..new_commit
    │
    ├── 4. For each anchor in changed files:
    │       ├── Phase 1: Hash check at original lines
    │       ├── Phase 2: Exact text search → auto-update if found
    │       ├── Phase 3: Fuzzy LCS match → mark drifted if similar
    │       └── Phase 4: Rename detection → update filePath
    │
    ├── 5. Bulk-update anchor statuses in DB
    │
    └── 6. Return { newCommit, anchorsAffected: { unchanged, autoUpdated, drifted, orphaned } }
```

---

## 8. Dual Mode Architecture

### 8.1 Mode Determination

The mode is derived, not stored:

```
if (sandbox exists for cluster AND sandbox.status == 'active')
    → Sandbox mode
else
    → URL Browse mode
```

### 8.2 URL Browse Mode

- Code fetched on-demand via GitHub REST API, proxied through the Java backend (avoids CORS, enables caching)
- Caching: file content cached for 5 minutes, tree/branches cached for 1 minute
- Anchor creation: backend fetches file content from GitHub API to compute `contentHash` and store `anchoredText`
- No automatic anchor re-matching (no git history available)

### 8.3 URL Provider Detection

The backend parses `repoUrl` to determine the hosting provider:

| Provider | URL Pattern | Status |
|----------|-------------|--------|
| GitHub | `github.com` | Supported (V1) |
| GitLab | `gitlab.com` | Requires sandbox mode |
| Bitbucket | `bitbucket.org` | Requires sandbox mode |
| Other | Any other | Requires sandbox mode |

### 8.4 Mode Switching

```
URL Browse ──[Provision Sandbox]──> Sandbox Mode
                                        │
                                   [Terminate Sandbox]
                                        │
                                        ▼
                                   URL Browse
```

**URL → Sandbox:** Existing anchors are validated against the cloned repo. `commitSha` is populated for anchors that were null (created in URL-browse mode).

**Sandbox → URL:** Cloned repo deleted. Sandbox record deleted. Anchors remain but revert to static behavior (no auto re-matching).

---

## 9. Frontend Architecture

### 9.1 Routes

No new routes. The existing cluster page route renders `ProjectClusterView` when `cluster.type === "project"`:

```typescript
// web/src/app/brain/[brainId]/cluster/[clusterId]/page.tsx
if (cluster.type === "project") {
  return <ProjectClusterView cluster={cluster} brainId={brainId} />;
}
```

### 9.2 New Hooks

| Hook | Key State / Actions | Query Key |
|------|---------------------|-----------|
| `useProjectConfig(clusterId)` | `config`, `updateConfig` | `["project-config", clusterId]` |
| `useSandbox(clusterId)` | `sandbox`, `provision`, `terminate`, `pull`, `checkout` | `["sandbox", clusterId]` |
| `useFileTree(clusterId, path)` | `entries`, `loading` | `["file-tree", clusterId, path]` |
| `useFileContent(clusterId, path)` | `content`, `language` | `["file-content", clusterId, path]` |
| `useNeuronAnchors(clusterId)` | `anchors`, `createAnchor`, `updateAnchor`, `deleteAnchor`, `confirmDrift` | `["neuron-anchors", clusterId]` |
| `useFileAnchors(clusterId, path)` | `anchors` (filtered to current file) | `["neuron-anchors", clusterId, "file", path]` |
| `useOrphanedAnchors(clusterId)` | `orphans` | `["neuron-anchors", clusterId, "orphaned"]` |
| `useGitLog(clusterId, limit)` | `commits` | `["git-log", clusterId]` |
| `useGitBlame(clusterId, path)` | `blame` | `["git-blame", clusterId, path]` |
| `useCodeStructure(clusterId, path)` | `symbols` | `["code-structure", clusterId, path]` |
| `useCodeSearch(clusterId, query)` | `results`, `search` | `["code-search", clusterId, query]` |

### 9.3 New Components

```
web/src/components/project/
├── ProjectClusterView.tsx       # Main three-panel layout
├── FileTreePanel.tsx            # Left: file browser
├── CodeViewer.tsx               # Center: read-only code + anchor gutter
├── NeuronPanel.tsx              # Right: neuron list + orphans
├── AnchorGutter.tsx             # CodeMirror gutter extension
├── CreateAnchorDialog.tsx       # Create neuron + anchor atomically
├── FileStructurePanel.tsx       # Symbol outline (tree-sitter)
├── QuickOpenDialog.tsx          # Ctrl+P file search
├── BranchSelector.tsx           # Branch dropdown
├── GitLogPanel.tsx              # Commit history
├── BlameView.tsx                # Blame annotations
├── DiffView.tsx                 # Diff viewer
├── OrphanList.tsx               # Orphaned/drifted anchor management
├── SandboxStatusBar.tsx         # Footer status bar
└── ProvisionSandboxDialog.tsx   # Sandbox provisioning
```

### 9.4 TypeScript Types

```typescript
// Additions to web/src/types/index.ts

interface ProjectConfig {
  id: string;
  clusterId: string;
  repoUrl: string;
  defaultBranch: string | null;
  createdAt: string;
  updatedAt: string;
}

type AnchorStatus = "active" | "drifted" | "orphaned";

interface NeuronAnchor {
  id: string;
  neuronId: string;
  clusterId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  contentHash: string;
  commitSha: string | null;
  status: AnchorStatus;
  driftedStartLine: number | null;
  driftedEndLine: number | null;
  createdAt: string;
  updatedAt: string;
}

interface FileTreeEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number | null;
}

interface FileContent {
  path: string;
  content: string;
  language: string;
  size: number;
}

interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

interface BlameLine {
  line: number;
  commitSha: string;
  author: string;
  date: string;
  content: string;
}

interface CodeSymbol {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  children: CodeSymbol[];
}

interface AnchorReconciliationResult {
  newCommit: string;
  anchorsAffected: {
    unchanged: number;
    autoUpdated: number;
    drifted: number;
    orphaned: number;
  };
}
```

### 9.5 API Client Extensions

```typescript
// Additions to web/src/lib/api.ts

// Project config
getProjectConfig(clusterId: string): Promise<ProjectConfig>
updateProjectConfig(clusterId: string, data: Partial<ProjectConfig>): Promise<ProjectConfig>

// File browsing (auto-routes to browse/ or sandbox/ based on mode)
getFileTree(clusterId: string, path?: string, ref?: string): Promise<FileTreeEntry[]>
getFileContent(clusterId: string, path: string, ref?: string): Promise<FileContent>

// Neuron anchors
listAnchors(clusterId: string, page?: number, size?: number): Promise<PaginatedResponse<NeuronAnchor>>
listFileAnchors(clusterId: string, path: string): Promise<NeuronAnchor[]>
listOrphanedAnchors(clusterId: string): Promise<NeuronAnchor[]>
createAnchor(data: CreateAnchorRequest): Promise<NeuronAnchor>
updateAnchor(id: string, data: UpdateAnchorRequest): Promise<NeuronAnchor>
deleteAnchor(id: string): Promise<void>
confirmDrift(id: string): Promise<NeuronAnchor>

// Git operations (sandbox only)
gitLog(clusterId: string, limit?: number, offset?: number): Promise<GitCommit[]>
gitBlame(clusterId: string, path: string): Promise<BlameLine[]>
gitDiff(clusterId: string, from: string, to: string): Promise<string>

// Code intelligence (sandbox only)
getCodeStructure(clusterId: string, path: string): Promise<CodeSymbol[]>
getDefinition(clusterId: string, path: string, line: number, col: number): Promise<Location>
getReferences(clusterId: string, path: string, line: number, col: number): Promise<Location[]>
```

---

## 10. Server-Side Architecture

### 10.1 New Backend Services

| Service | Purpose |
|---------|---------|
| `ProjectConfigService` | CRUD for project configuration; creates ProjectConfig on cluster creation |
| `SandboxService` | Sandbox lifecycle (provision, terminate, file serving, git operations via JGit) |
| `GitOperationService` | JGit wrapper: log, blame, diff, branch operations |
| `AnchorService` | Anchor CRUD + reconciliation algorithm (4-phase re-matching) |
| `UrlBrowseService` | Proxy for GitHub API (tree, file content, branches); includes caching |
| `SandboxCleanupScheduler` | Scheduled task to terminate stale sandboxes (configurable inactive days) |

### 10.2 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_BASE_DIR` | `/data/sandboxes` | Base directory for cloned repos |
| `SANDBOX_MAX_REPO_SIZE_MB` | `500` | Maximum allowed repo size |
| `SANDBOX_CLONE_TIMEOUT_SEC` | `300` | Clone operation timeout |
| `SANDBOX_STALE_DAYS` | `30` | Days before auto-cleanup |
| `ANCHOR_FUZZY_THRESHOLD` | `0.7` | LCS similarity threshold for fuzzy re-matching |
| `GITHUB_API_TOKEN` | (empty) | Optional GitHub API token for higher rate limits |

---

## 11. Security

| Concern | Mitigation |
|---------|------------|
| **SSRF via repoUrl** | Validate URL format. Block private IP ranges, localhost, `file://` protocol. Allow only HTTPS. |
| **Path traversal** | All file paths resolved relative to sandbox root. Reject paths containing `..` or absolute paths. Canonicalize and verify prefix. |
| **Resource exhaustion** | Max repo size limit. Clone timeout. Sandbox count limit. |
| **GitHub API rate limits** | Cache responses. Optional `GITHUB_API_TOKEN` for authenticated requests (5000/hr vs 60/hr). |
| **Sandbox isolation** | Sandbox directory has no access to BrainBook application data. Read-only filesystem access from the API layer. |
| **Git hooks** | Disabled during clone (`--config core.hooksPath=/dev/null`). |
| **Submodules / LFS** | Disabled by default (`--no-recurse-submodules`, no LFS). |

---

## 12. Data Flow Diagrams

### 12.1 Project Cluster Creation

```
User                      Frontend                  Backend
  │                           │                        │
  │ Enter repo URL + name     │                        │
  │──────────────────────────>│                        │
  │                           │ POST /api/clusters     │
  │                           │  { type: "project",    │
  │                           │    repoUrl: "...",     │
  │                           │    defaultBranch: ".." }│
  │                           │───────────────────────>│
  │                           │                        │ Create Cluster (type=project)
  │                           │                        │ Create ProjectConfig
  │                           │<───────────────────────│
  │                           │ ClusterResponse        │
  │ Redirect to cluster page  │                        │
  │<──────────────────────────│                        │
```

### 12.2 Neuron Anchor Creation (Atomic)

```
User                      Frontend                  Backend
  │                           │                        │
  │ Select lines 15-22        │                        │
  │ Enter neuron title        │                        │
  │──────────────────────────>│                        │
  │                           │ POST /api/neurons      │
  │                           │  { title, brainId,     │
  │                           │    clusterId,          │
  │                           │    anchor: {           │
  │                           │      filePath,         │
  │                           │      startLine: 15,    │
  │                           │      endLine: 22 } }   │
  │                           │───────────────────────>│ BEGIN TRANSACTION
  │                           │                        │ Create Neuron
  │                           │                        │ Read file content (lines 15-22)
  │                           │                        │ Compute contentHash
  │                           │                        │ Create NeuronAnchor
  │                           │                        │ COMMIT
  │                           │<───────────────────────│
  │ Anchor marker appears     │ NeuronResponse +       │
  │<──────────────────────────│ AnchorResponse         │
```

### 12.3 Pull + Anchor Reconciliation

```
User                      Frontend                  Backend
  │                           │                        │
  │ Click [Pull]              │                        │
  │──────────────────────────>│                        │
  │                           │ POST .../sandbox/pull  │
  │                           │───────────────────────>│ git pull
  │                           │                        │ Get changed files (git diff)
  │                           │                        │ For each anchor in changed files:
  │                           │                        │   Phase 1: hash check
  │                           │                        │   Phase 2: exact search → auto-update
  │                           │                        │   Phase 3: fuzzy LCS → drifted
  │                           │                        │   Phase 4: rename check → orphaned
  │                           │                        │ Bulk update anchors
  │                           │<───────────────────────│
  │                           │ { newCommit,           │
  │                           │   anchorsAffected: {   │
  │                           │     unchanged: 12,     │
  │                           │     autoUpdated: 2,    │
  │                           │     drifted: 1,        │
  │                           │     orphaned: 1 } }    │
  │ See status updates        │                        │
  │ Drifted/orphans in panel  │                        │
  │<──────────────────────────│                        │
```

---

## 13. Test Strategy

### 13.1 Backend (Java)

**AnchorService (unit tests):**
- Test each reconciliation phase independently with synthetic file content (no git needed)
- Edge cases: file deleted, renamed, content partially changed, blank file, identical content at multiple locations, content at multiple fuzzy-match candidates
- Verify hash normalization handles trailing whitespace, blank edge lines

**GitOperationService (integration tests):**
- Create temporary git repos in `@BeforeEach` (JGit `InitCommand`)
- Create commits, verify log/blame/diff output
- Test pull with conflicts, branch switch

**UrlBrowseService (unit tests):**
- Mock GitHub API with WireMock
- Test tree listing, file content, branch listing, rate limit handling, caching

**ProjectConfigService / SandboxService:**
- Standard Spring Boot `@SpringBootTest` with TestContainers (PostgreSQL)
- Test lifecycle: create config, provision sandbox, terminate

### 13.2 Frontend (TypeScript)

**Component tests (Vitest + React Testing Library):**
- `ProjectClusterView`: renders file tree, code viewer, neuron panel
- `AnchorGutter`: renders markers at correct lines
- `OrphanList`: displays orphaned/drifted anchors with correct actions
- `CreateAnchorDialog`: validates line range, submits atomically

**E2E tests (Playwright):**
- Full flow: create project cluster → browse files → select lines → create anchored neuron → verify anchor marker appears
- Sandbox flow: provision → pull → verify anchor reconciliation UI

### 13.3 Intelligence Service (Python)

**pytest with sample source files:**
- Symbol extraction for each supported language (Java, Python, TypeScript, Go, etc.)
- Definition finding within a single file
- Reference finding across multiple files
- Edge cases: empty files, syntax errors, very large files

---

## 14. Implementation Sequence

### Phase 1: Foundation

1. V26 migration (drop unique index, create tables)
2. Modify `ClusterType.isUnique()` to exclude PROJECT
3. `ProjectConfig` entity, repository, service
4. Extend cluster creation to accept `repoUrl`, create `ProjectConfig` in same transaction
5. `NeuronAnchor` entity, repository, service (CRUD only, no reconciliation)
6. Extend neuron creation with optional `anchor` field

### Phase 2: URL Browse Mode

7. `UrlBrowseService` — proxy GitHub API for file tree and content
8. `ProjectClusterView` component (replaces "coming soon" placeholder)
9. `FileTreePanel`, `CodeViewer` (CodeMirror read-only), `NeuronPanel`
10. `CreateAnchorDialog` and anchor creation flow
11. `AnchorGutter` markers in CodeViewer

### Phase 3: Sandbox Mode

12. `SandboxService` — clone, terminate lifecycle (JGit)
13. `GitOperationService` — pull, checkout, log, blame, diff
14. Anchor reconciliation algorithm (4 phases) in `AnchorService`
15. `ProvisionSandboxDialog`, `SandboxStatusBar`

### Phase 4: Code Intelligence

16. Intelligence service: tree-sitter endpoints (structure, definition, references)
17. `FileStructurePanel` component
18. Go-to-definition Ctrl+Click integration
19. `QuickOpenDialog`
20. Full-text codebase search

### Phase 5: Polish

21. `BranchSelector` with checkout
22. `GitLogPanel`, `BlameView`, `DiffView`
23. `OrphanList` management UI
24. Sandbox sidebar section (see sandbox-management spec)
25. `SandboxCleanupScheduler`
26. Keyboard shortcuts

---

## Recent Fixes (Post-Implementation)

The following improvements were made after the initial project cluster implementation:

### File Tree Panel
- **Folder collapse fix:** Directories start collapsed by default (`useState(false)` instead of `useState(depth === 0)`), fixing a mismatch where the chevron showed "expanded" but no children were visible on initial load.
- **Search button:** Added `FILES` header with a search icon button (`onOpenSearch` prop) that opens the `QuickOpenDialog`. Tooltip shows "Search files (Ctrl+P)".

### Neuron Panel
- **Tabs:** Added "This File" / "All Neurons" tab switcher. "This File" shows existing file-anchored neurons. "All Neurons" shows all cluster neurons with a search input for filtering by title or content.
- **File navigation:** Clicking a file path in the "All Neurons" tab navigates to that file in the code viewer.

### Browse Tree Loading
- **Config-aware loading:** Browse tree query now waits for `useProjectConfig` to resolve before firing, ensuring the correct `defaultBranch` ref is used. Previously, the tree query could fire with `ref = undefined` before config loaded, causing failures when the repo's default branch wasn't "main".
- **Loading state:** `treeLoading` includes `configLoading` to show the loading spinner while config loads.

### Sandbox Error State
- **Terminate button:** The `SandboxStatusBar` now shows the Terminate button when sandbox is in `error` state (not just `active`), allowing users to clean up a failed sandbox and re-provision.
