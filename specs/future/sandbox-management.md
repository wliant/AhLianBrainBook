# Sandbox Management

## 1. Context

### Why a Separate Feature

The Project Cluster feature (`specs/06-project-cluster.md`) defines two modes for browsing codebases:

1. **URL browse mode** (default) — lightweight, no server resources. Code fetched via hosting provider API.
2. **Sandbox mode** — server clones the git repo into a managed directory. Enables full git operations, tree-sitter indexing, full-text search, and automatic anchor reconciliation.

Sandbox mode is a separate feature spec because it introduces infrastructure concerns absent from URL browse mode: disk consumption, lifecycle management, security surface, and resource contention. This document specifies the sandbox infrastructure that the Project Cluster's sandbox mode depends on.

### When Sandbox Mode Is Needed

| Capability | URL Browse | Sandbox |
|------------|-----------|---------|
| Browse file tree | Yes (via GitHub API) | Yes (local filesystem) |
| View file content | Yes (via GitHub API) | Yes (local filesystem) |
| Syntax highlighting | Yes (client-side) | Yes (client-side) |
| Git log (full history) | Limited (API pagination) | Yes |
| Git blame | No | Yes |
| Git diff (arbitrary commits) | No | Yes |
| Branch switch | Limited (API-based) | Yes (local checkout) |
| Tree-sitter symbol navigation | No | Yes |
| Full-text codebase search | No | Yes |
| Anchor reconciliation on pull | No | Yes |
| Works with non-GitHub repos | No | Yes |
| Requires server disk space | No | Yes |

**Rule:** URL browse mode is the default. Sandbox mode is explicitly provisioned by the user when they need capabilities beyond what the hosting API provides.

---

## 2. Sandbox Lifecycle

### 2.1 Status Diagram

```
[No Sandbox] ── Provision ──> [Cloning] ── Success ──> [Indexing] ── Done ──> [Active]
                                  │                                              │
                                  │ Failure                           User terminates
                                  ▼                                              │
                              [Error]                               [Terminating] ──> [Deleted]
                                  │
                                  │ Retry
                                  ▼
                              [Cloning]

Active sandbox operations:
  [Active] ── pull ──> [Active]
  [Active] ── checkout branch ──> [Active]
  [Active] ── idle N days ──> cleanup job ──> [Deleted]
```

### 2.2 Status Enum

| Status | Description |
|--------|-------------|
| `cloning` | Initial git clone in progress |
| `indexing` | Clone complete, tree-sitter pre-indexing in progress |
| `active` | Ready for use |
| `error` | Clone or indexing failed; user can retry |
| `terminating` | Cleanup in progress (deleting files) |

### 2.3 Lifecycle Operations

| Operation | Trigger | Behavior |
|-----------|---------|----------|
| **Provision** | User clicks "Provision Sandbox" | Validate URL → create sandbox record (status=cloning) → async clone |
| **Clone complete** | Async task finishes | Status → indexing → trigger tree-sitter pre-index → status → active |
| **Pull** | User clicks "Pull" | `git pull --ff-only`, re-index changed files, run anchor reconciliation |
| **Branch switch** | User selects branch | `git checkout <branch>`, re-index, run anchor reconciliation |
| **Terminate** | User clicks "Terminate Sandbox" | Status → terminating → async delete directory → delete sandbox record |
| **Auto-cleanup** | Scheduled job (daily) | Terminate sandboxes not accessed in N days (configurable, default 30) |
| **Retry** | User clicks "Retry" on error | Delete partial clone if any, restart clone |

---

## 3. Data Model

### 3.1 Sandboxes Table

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| cluster_id | UUID | NOT NULL, FK → clusters ON CASCADE, UNIQUE | Parent project cluster |
| brain_id | UUID | NOT NULL, FK → brains ON CASCADE | Parent brain (denormalized for sidebar query) |
| repo_url | VARCHAR(2000) | NOT NULL | Git remote URL |
| current_branch | VARCHAR(255) | NOT NULL | Currently checked-out branch |
| current_commit | VARCHAR(40) | nullable | Current HEAD commit SHA |
| sandbox_path | VARCHAR(500) | NOT NULL | Absolute path to cloned repo on host filesystem |
| is_shallow | boolean | NOT NULL, default true | Whether clone is shallow (`--depth 1`) |
| status | VARCHAR(20) | NOT NULL, default 'cloning' | Lifecycle status |
| disk_usage_bytes | bigint | nullable | Last measured disk usage |
| error_message | TEXT | nullable | Error details when status = error |
| last_accessed_at | TIMESTAMP | NOT NULL | Last user interaction timestamp |
| created_at | TIMESTAMP | NOT NULL, auto-set | Provision timestamp |
| updated_at | TIMESTAMP | NOT NULL, auto-updated | Last modification timestamp |

**Constraints:**
- CHECK: `status IN ('cloning', 'indexing', 'active', 'error', 'terminating')`
- UNIQUE(`cluster_id`) — one sandbox per project cluster

**Indexes:**
- `idx_sandboxes_cluster` on `cluster_id`
- `idx_sandboxes_brain` on `brain_id`
- `idx_sandboxes_status` on `status`
- `idx_sandboxes_last_accessed` on `last_accessed_at` (for cleanup job)

**Design note:** `brain_id` is denormalized from the cluster for sidebar query efficiency (listing all sandboxes with brain names without joining through clusters).

### 3.2 Private Repo Credentials (Deferred)

Private repository support is deferred to a future iteration. V1 supports public repositories only.

When implemented, credentials will be stored in a separate `sandbox_credentials` table with AES-256-GCM encryption at rest. The encryption key will be provided via environment variable, not stored in the database. Credentials will only be decrypted in memory immediately before a git operation.

### 3.3 Flyway Migration

The sandboxes table is created as part of V26 (same migration as project_configs and neuron_anchors in the project cluster spec) or as a separate V27 if implemented after the core project cluster feature:

```sql
-- Sandboxes (part of project cluster infrastructure)
CREATE TABLE sandboxes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id        UUID NOT NULL UNIQUE REFERENCES clusters(id) ON DELETE CASCADE,
    brain_id          UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
    repo_url          VARCHAR(2000) NOT NULL,
    current_branch    VARCHAR(255) NOT NULL,
    current_commit    VARCHAR(40),
    sandbox_path      VARCHAR(500) NOT NULL,
    is_shallow        BOOLEAN NOT NULL DEFAULT true,
    status            VARCHAR(20) NOT NULL DEFAULT 'cloning',
    disk_usage_bytes  BIGINT,
    error_message     TEXT,
    last_accessed_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT check_sandbox_status
        CHECK (status IN ('cloning', 'indexing', 'active', 'error', 'terminating'))
);

CREATE INDEX idx_sandboxes_cluster ON sandboxes(cluster_id);
CREATE INDEX idx_sandboxes_brain ON sandboxes(brain_id);
CREATE INDEX idx_sandboxes_status ON sandboxes(status);
CREATE INDEX idx_sandboxes_last_accessed ON sandboxes(last_accessed_at);
```

### 3.4 Brain Deletion Cascade

When a brain is deleted, all its sandboxes must be terminated (directory cleanup) before the CASCADE delete removes the database rows. This requires service-level orchestration: `BrainService.delete()` must call `SandboxService.terminateAllForBrain(brainId)` before deleting the brain entity, or use a `@PreRemove` entity listener.

---

## 4. API Endpoints

### 4.1 Sandbox Lifecycle

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| POST | `/api/clusters/{clusterId}/sandbox` | Provision sandbox (clone repo) | 202 Accepted + SandboxResponse |
| GET | `/api/clusters/{clusterId}/sandbox` | Get sandbox status | 200 OK or 404 |
| DELETE | `/api/clusters/{clusterId}/sandbox` | Terminate sandbox | 202 Accepted |
| POST | `/api/clusters/{clusterId}/sandbox/retry` | Retry failed provision | 202 Accepted + SandboxResponse |

### 4.2 Sandbox Operations (require status = active)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/clusters/{clusterId}/sandbox/pull` | Pull latest from remote |
| POST | `/api/clusters/{clusterId}/sandbox/checkout` | Switch branch |
| GET | `/api/clusters/{clusterId}/sandbox/branches` | List available branches |
| GET | `/api/clusters/{clusterId}/sandbox/tree?path=` | Directory listing |
| GET | `/api/clusters/{clusterId}/sandbox/file?path=` | File content |
| GET | `/api/clusters/{clusterId}/sandbox/search?q=&regex=` | Full-text search |
| GET | `/api/clusters/{clusterId}/sandbox/log?limit=&offset=` | Git log |
| GET | `/api/clusters/{clusterId}/sandbox/blame?path=` | Git blame |
| GET | `/api/clusters/{clusterId}/sandbox/diff?from=&to=` | Git diff |

### 4.3 Global Sandbox Listing (for sidebar)

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| GET | `/api/sandboxes` | List all active sandboxes across all brains | 200 OK + SandboxResponse[] |
| GET | `/api/sandboxes/stats` | Aggregate stats | 200 OK + SandboxStatsResponse |

### 4.4 SSE Events

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/clusters/{clusterId}/sandbox/events` | SSE stream for sandbox operations |

**Event types:**

| Event | Data | When |
|-------|------|------|
| `sandbox-ready` | `{ clusterId, branch, commit }` | Clone + indexing complete |
| `sandbox-error` | `{ clusterId, error }` | Clone or operation failed |
| `pull-complete` | `{ clusterId, commit, anchorsAffected }` | Pull done, anchors re-matched |

### 4.5 Request/Response DTOs

**ProvisionSandboxRequest:**
```json
{
  "branch": "main",
  "shallow": true
}
```

The `repoUrl` is read from the cluster's `ProjectConfig`, not passed in the request.

**SandboxResponse:**
```json
{
  "id": "uuid",
  "clusterId": "uuid",
  "brainId": "uuid",
  "brainName": "string",
  "clusterName": "string",
  "repoUrl": "https://github.com/user/repo.git",
  "currentBranch": "main",
  "currentCommit": "abc123...",
  "isShallow": true,
  "status": "active",
  "diskUsageBytes": 52428800,
  "errorMessage": null,
  "lastAccessedAt": "2026-04-02T10:30:00",
  "createdAt": "2026-04-01T14:00:00",
  "updatedAt": "2026-04-02T10:30:00"
}
```

**SandboxStatsResponse:**
```json
{
  "activeSandboxCount": 3,
  "totalDiskUsageBytes": 157286400,
  "maxDiskUsageBytes": 5368709120
}
```

---

## 5. Sidebar UI Concept

A new collapsible section in the existing Sidebar component, visible only when at least one sandbox exists.

```
┌──────────────────────┐
│  Home                │
│                      │
│  ▼ BRAINS            │
│    Backend Eng       │
│    ML Research       │
│                      │
│  ▼ THOUGHTS          │
│    Design Patterns   │
│                      │
│  ▼ SANDBOXES (2)     │
│    ● spring-framework│   ← green dot = active
│      Backend Eng     │   ← brain name, dimmed
│    ◌ my-ml-project   │   ← hollow circle = cloning
│      ML Research     │
│                      │
│  Settings            │
│  Review Queue (3)    │
└──────────────────────┘
```

**Status indicators:**
- Green dot `●` = active
- Spinner `◌` = cloning / indexing
- Red dot `●` = error
- Grey dot `●` = terminating

**Click action:** Navigate to the project cluster page for that sandbox.

### Provision Dialog

Triggered by "Provision Sandbox" button on the project cluster page:
- Branch (default: from `ProjectConfig.defaultBranch` or "main")
- Clone depth: shallow (default) or full
- Repository URL shown (read-only, from ProjectConfig)

### Terminate Confirmation

"This will delete the cloned repository from the server. Your notes and anchors will be preserved. You can re-provision later."

---

## 6. Storage Strategy

### 6.1 Directory Structure

```
/data/brainbook/sandboxes/
  ├── {sandbox-uuid-1}/
  │   └── repo/              ← cloned git repository
  ├── {sandbox-uuid-2}/
  │   └── repo/
  └── ...
```

UUID-based directory names avoid collisions and prevent information leakage.

### 6.2 Docker Volume Mount

Add to `docker-compose.app.yml`:

```yaml
services:
  app:
    volumes:
      - sandbox-data:/data/brainbook/sandboxes
    environment:
      SANDBOX_ROOT_PATH: /data/brainbook/sandboxes

volumes:
  sandbox-data:
```

### 6.3 Clone Strategy

- **Shallow clone** (default): `git clone --depth 1 --single-branch -b <branch> <url>` — minimal disk, fast. Limitations: no full log, blame limited to shallow commit.
- **Full clone** (user opt-in): `git clone -b <branch> <url>` — full history for log, blame, diff. Larger disk footprint.
- **Unshallow upgrade**: Support `git fetch --unshallow` as a future operation for users who provisioned shallow and later need full history.

### 6.4 Disk Usage Tracking

- Measured after clone completes and after each pull
- Stored in `sandboxes.disk_usage_bytes`
- Periodic refresh via `SandboxDiskUsageScheduler` (every 6 hours)

### 6.5 Cleanup Policy

`SandboxCleanupScheduler` runs daily:
1. Find sandboxes where `last_accessed_at < NOW() - SANDBOX_STALE_DAYS` and `status = 'active'`
2. Set status to `terminating`
3. Delete sandbox directory
4. Delete database record

---

## 7. Security

### 7.1 URL Validation (SSRF Prevention)

Before cloning, validate the repository URL:

1. **Protocol whitelist** — only `https://`. Reject `file://`, `ftp://`, `ssh://`, `gopher://`, etc.
2. **Host resolution check** — resolve hostname and reject if it resolves to:
   - Loopback addresses (`127.0.0.0/8`, `::1`)
   - Private network ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
   - Link-local addresses (`169.254.0.0/16`)
   - Docker internal DNS (`host.docker.internal`, container names)
3. **Host allowlist (optional)** — configurable list of allowed git hosting domains. If configured, only these hosts are permitted. If empty, all non-private hosts are allowed.

### 7.2 Directory Isolation

- Each sandbox in its own UUID directory under the sandbox root
- Sandbox root is a dedicated Docker volume, separated from application data and database volumes
- File-serving endpoints canonicalize paths: `Paths.get(sandboxPath).resolve(requestedPath).normalize()` must start with `Paths.get(sandboxPath).normalize()`
- Reject paths containing `..` or absolute paths

### 7.3 Git Operation Safety

- All git operations run in sandbox directory only, never in the application directory
- No push, commit, or write-to-remote operations exposed
- Git hooks disabled during clone: `--config core.hooksPath=/dev/null`
- Submodule initialization disabled: `--no-recurse-submodules`
- LFS disabled by default

---

## 8. Resource Limits and Quotas

| Limit | Default | Environment Variable |
|-------|---------|---------------------|
| Max total disk (all sandboxes) | 5 GB | `SANDBOX_MAX_TOTAL_DISK_MB` |
| Max single repo size | 1 GB | `SANDBOX_MAX_REPO_SIZE_MB` |
| Clone timeout | 5 minutes | `SANDBOX_CLONE_TIMEOUT_SEC` |
| Max concurrent clones | 2 | `SANDBOX_MAX_CONCURRENT_CLONES` |
| Inactive cleanup threshold | 30 days | `SANDBOX_STALE_DAYS` |
| Max sandboxes total | 10 | `SANDBOX_MAX_COUNT` |

### Enforcement

- **Before provisioning:** Check total disk usage + active sandbox count against limits. Reject with 409 Conflict if exceeded.
- **During clone:** Monitor directory size at checkpoints. Kill clone if exceeds max repo size. Set status to error: "Repository exceeds size limit."
- **Clone timeout:** Use JGit's `TransportCommand.setTimeout()`. Kill and clean up on timeout.
- **Concurrent clones:** `Semaphore(maxConcurrentClones)` in `SandboxService`. Reject with 429 Too Many Requests if all slots occupied.

---

## 9. Monitoring

### 9.1 Spring Boot Health Indicator

`SandboxHealthIndicator` reports via `/actuator/health`:
- Number of active sandboxes
- Total disk usage vs. max allowed
- Number of stale sandboxes (past cleanup threshold)
- Sandbox root directory writability

### 9.2 Metrics (Micrometer)

| Metric | Type | Description |
|--------|------|-------------|
| `sandbox.count` | Gauge | Number of sandboxes by status |
| `sandbox.disk.usage.bytes` | Gauge | Total disk usage |
| `sandbox.disk.usage.ratio` | Gauge | Usage / max total disk (0.0-1.0) |
| `sandbox.clone.duration` | Timer | Clone operation duration |
| `sandbox.clone.failures` | Counter | Failed clone attempts |

---

## 10. Architecture Decision: JGit vs Git CLI

### Comparison

| Aspect | JGit (Pure Java) | Git CLI (Process) |
|--------|-------------------|-------------------|
| Dependency | Maven/Gradle dependency | `git` binary in Docker image |
| Docker image | No change | Must add git package (~20MB) |
| API | Programmatic, type-safe | String output parsing |
| Clone / Pull / Checkout | Supported | Full feature set |
| Log / Blame / Diff | Supported | Identical to native git |
| Credential handling | `CredentialsProvider` (in-memory) | `GIT_ASKPASS` script (complex) |
| Timeout / Cancel | `ProgressMonitor` with cancellation | `Process.destroyForcibly()` |
| Performance | Slower for very large repos | Faster for large repos |
| SSH support | Via Apache MINA SSHD (extra dep) | Native |

### Recommendation: JGit

1. No Docker image changes
2. Type-safe API, no string parsing
3. Clean credential handling (future)
4. Read-only use case — JGit's performance gaps are in write-heavy scenarios
5. ProgressMonitor allows graceful cancellation during long operations

**Fallback:** If JGit proves too slow for specific operations (blame on very large files, diff on deep history), individual operations can be migrated to CLI via `ProcessBuilder` per-operation.

**Dependency:**
```gradle
implementation 'org.eclipse.jgit:org.eclipse.jgit:7.1.0.202411261347-r'
```

---

## 11. Backend Service Design

### SandboxService

Core service managing sandbox lifecycle. Follows the existing `ClusterService` pattern.

- `provision(UUID clusterId, ProvisionSandboxRequest request)` — validate, create record, async clone
- `terminate(UUID clusterId)` — set terminating, async cleanup
- `terminateAllForBrain(UUID brainId)` — called before brain deletion
- `getByClusterId(UUID clusterId)` — sandbox metadata
- `getAllActive()` — for sidebar listing
- `getStats()` — aggregate statistics
- `retry(UUID clusterId)` — retry failed provision
- `updateLastAccessed(UUID sandboxId)` — called on each user interaction
- `getFileTree(UUID sandboxId, String path)` — directory listing
- `getFileContent(UUID sandboxId, String path)` — file content
- `searchFiles(UUID sandboxId, String query, boolean regex)` — full-text search

### GitOperationService

JGit wrapper, isolated from lifecycle management.

- `cloneRepository(String repoUrl, String branch, Path targetDir, boolean shallow)`
- `pull(Path repoDir)`
- `checkout(Path repoDir, String branch)`
- `listBranches(Path repoDir)`
- `log(Path repoDir, int limit, int offset)`
- `blame(Path repoDir, String filePath)`
- `diff(Path repoDir, String fromRef, String toRef)`

### SandboxCleanupScheduler

Scheduled service (`@Scheduled`) that runs daily. Same pattern as existing `ReminderSchedulerService`.

### SandboxDiskUsageScheduler

Runs every 6 hours. Refreshes `disk_usage_bytes` for all active sandboxes.

---

## 12. Frontend Implementation

### New Hooks

**`useSandbox(clusterId)`** — TanStack React Query, follows `useClusters` pattern:
- State: `sandbox`, `loading`, `error`
- Mutations: `provision()`, `terminate()`, `pull()`, `checkout()`, `retry()`
- Query key: `["sandbox", clusterId]`

**`useSandboxList()`** — for sidebar:
- State: `sandboxes`, `loading`
- Query key: `["sandboxes"]`

### Sidebar Integration

Modify `web/src/components/layout/Sidebar.tsx`:
- Add collapsible "Sandboxes" section using `useSandboxList()` hook
- Only render when `sandboxes.length > 0`
- Each entry: status indicator + repo name + brain name
- Click navigates to project cluster page

### TypeScript Types

```typescript
type SandboxStatus = "cloning" | "indexing" | "active" | "error" | "terminating";

interface Sandbox {
  id: string;
  clusterId: string;
  brainId: string;
  brainName: string;
  clusterName: string;
  repoUrl: string;
  currentBranch: string;
  currentCommit: string | null;
  isShallow: boolean;
  status: SandboxStatus;
  diskUsageBytes: number | null;
  errorMessage: string | null;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface SandboxStats {
  activeSandboxCount: number;
  totalDiskUsageBytes: number;
  maxDiskUsageBytes: number;
}

interface ProvisionSandboxRequest {
  branch: string;
  shallow: boolean;
}
```

---

## 13. Implementation Sequence

| Phase | What | Dependencies |
|-------|------|-------------|
| 1 | Flyway migration (sandboxes table) | Project cluster V26 migration |
| 2 | JPA entity: `Sandbox`, `SandboxStatus` enum | Phase 1 |
| 3 | `SandboxRepository` | Phase 2 |
| 4 | Add JGit dependency to `build.gradle` | None |
| 5 | `GitOperationService` (JGit wrapper) | Phase 4 |
| 6 | `SandboxService` (lifecycle + file serving) | Phases 3, 5 |
| 7 | `SandboxController` (REST endpoints) | Phase 6 |
| 8 | SSE endpoint for sandbox events | Phase 7 |
| 9 | Docker volume mount in compose files | Phase 6 |
| 10 | `SandboxCleanupScheduler`, `SandboxDiskUsageScheduler` | Phase 6 |
| 11 | Frontend types + `useSandbox` hook | Phase 7 |
| 12 | Sandbox sidebar section + `useSandboxList` hook | Phase 11 |
| 13 | Project cluster page integration (provision/terminate UI) | Phase 11 |

---

## 14. Future Enhancements

| Feature | Description |
|---------|-------------|
| **Private repo credentials** | `sandbox_credentials` table with AES-256-GCM encryption. Token and SSH key support. |
| **Unshallow upgrade** | Convert shallow clone to full clone (`git fetch --unshallow`) without re-provisioning |
| **Sandbox snapshots** | Save/restore sandbox state (branch, commit) for reproducible study sessions |
| **Multi-user sandbox sharing** | Share a sandbox across users (requires auth system) |
| **Sandbox resource dashboard** | Admin page showing all sandboxes, disk usage graphs, cleanup history |
