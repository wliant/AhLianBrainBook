# Sandbox Management

> **Status: Implemented.** Originally a planning spec; updated to reflect actual implementation. The architecture diverged from the original plan: instead of an embedded JGit-based solution, sandbox management is a standalone Go microservice accessed via gRPC.

## 1. Context

### Why a Separate Feature

The Project Cluster feature (`specs/06-project-cluster.md`) defines two modes for browsing codebases:

1. **URL browse mode** (default) — lightweight, no server resources. Code fetched via hosting provider API.
2. **Sandbox mode** — a standalone service clones the git repo into a managed directory. Enables full git operations, file browsing from the local filesystem, and code intelligence features.

Sandbox mode is a separate feature spec because it introduces infrastructure concerns absent from URL browse mode: disk consumption, lifecycle management, security surface, resource contention, and a dedicated microservice.

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
| Code intelligence (structure, definition, references) | No | Yes (via intelligence-service) |
| Works with private repos (GitHub PAT) | No | Yes |
| Works with non-GitHub repos | No | Yes |
| Requires server disk space | No | Yes |

**Rule:** URL browse mode is the default. Sandbox mode is explicitly provisioned by the user when they need capabilities beyond what the hosting API provides.

---

## 2. Sandbox Lifecycle

### 2.1 Status Diagram

```
[No Sandbox] ── Provision ──> [Cloning] ── Success ──> [Active]
                                  │                        │
                                  │ Failure      User terminates
                                  v                        │
                              [Error]           [Terminating] ──> [Deleted]
                                  │
                                  │ Retry
                                  v
                              [Cloning]

Active sandbox operations:
  [Active] ── pull ──> [Active]
  [Active] ── checkout branch ──> [Active]
  [Active] ── idle N days ──> cleanup job ──> [Deleted]
```

Note: The `indexing` status exists in the status enum but is currently unused. The Go service transitions directly from `cloning` to `active` after a successful clone.

### 2.2 Status Enum

| Status | Description |
|--------|-------------|
| `cloning` | Initial git clone in progress |
| `indexing` | Reserved for future use (tree-sitter pre-indexing) |
| `active` | Ready for use |
| `error` | Clone or indexing failed; user can retry |
| `terminating` | Cleanup in progress (deleting files) |

### 2.3 Lifecycle Operations

| Operation | Trigger | Behavior |
|-----------|---------|----------|
| **Provision** | User clicks "Provision Sandbox" | Validate URL (SSRF) -> check quotas -> create sandbox record (status=cloning) -> async clone |
| **Clone complete** | Async goroutine finishes | Check repo size limit -> read HEAD commit -> status -> active |
| **Pull** | User clicks "Pull" | `git pull`, update commit in DB. Frontend invalidates anchor queries. |
| **Branch switch** | User selects branch | `git checkout <branch>`, update branch + commit in DB |
| **Terminate** | User clicks "Terminate Sandbox" | Status -> terminating -> delete directory -> delete DB record |
| **Auto-cleanup** | `CleanupScheduler` (daily at 3 AM UTC) | Find sandboxes with `last_accessed_at` older than threshold -> delete directory -> delete DB record |
| **Retry** | User clicks "Retry" on error | Delete partial clone directory, reset status to cloning, restart clone |

---

## 3. Data Model

### 3.1 Proto Definition (Canonical)

The sandbox data model is defined in `proto/sandbox/v1/sandbox.proto`. The `SandboxInfo` message is the canonical representation:

```protobuf
message SandboxInfo {
  string id = 1;
  string cluster_id = 2;
  string brain_id = 3;
  string repo_url = 4;
  string current_branch = 5;
  string current_commit = 6;
  bool is_shallow = 7;
  string status = 8;
  int64 disk_usage_bytes = 9;
  string error_message = 10;
  google.protobuf.Timestamp last_accessed_at = 11;
  google.protobuf.Timestamp created_at = 12;
  google.protobuf.Timestamp updated_at = 13;
}
```

The Go model (`sandbox-service/internal/model/sandbox.go`) includes an additional `SandboxPath` field (the absolute path to the cloned repo on disk) that is internal to the sandbox-service and not exposed via gRPC.

### 3.2 Database

Sandbox data is owned by the standalone sandbox-service, stored in a separate PostgreSQL database (`sandbox`).

**Database initialization:** `docker/init-sandbox-db.sql` creates the `sandbox` database and user during infrastructure setup.

**Schema migration:** The sandbox-service runs its own migrations via golang-migrate (`sandbox-service/internal/store/migrations/001_create_sandboxes.up.sql`):

```sql
CREATE TABLE sandboxes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id        UUID NOT NULL UNIQUE,
    brain_id          UUID NOT NULL,
    repo_url          VARCHAR(2000) NOT NULL,
    current_branch    VARCHAR(255) NOT NULL,
    current_commit    VARCHAR(40),
    sandbox_path      VARCHAR(500) NOT NULL,
    is_shallow        BOOLEAN NOT NULL DEFAULT true,
    status            VARCHAR(20) NOT NULL DEFAULT 'cloning'
                      CHECK (status IN ('cloning','indexing','active','error','terminating')),
    disk_usage_bytes  BIGINT,
    error_message     TEXT,
    last_accessed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The table has no foreign key constraints to the main brainbook database (clusters, brains). The `cluster_id` and `brain_id` columns are plain UUID columns; referential integrity is managed at the application level.

**Main app migration history:** The main app's `V29__add_sandboxes_table.sql` originally created a sandboxes table with FK constraints. `V34__remove_sandboxes_table.sql` drops it, noting "Sandbox data is now owned by the standalone sandbox-service."

### 3.3 Private Repo Support (GitHub PAT)

Private repository cloning is supported via GitHub Personal Access Token:

- `GITHUB_PAT` environment variable is passed to the sandbox-service container
- `GitService.injectToken()` rewrites `github.com` URLs to embed the PAT as `x-access-token` in the URL userinfo
- Only GitHub is supported; non-GitHub hosts are passed through unchanged
- No per-repo credentials, no SSH key support, no encrypted credential storage

### 3.4 Brain Deletion Cascade

When a brain is deleted, the main app calls `SandboxGrpcClient.terminateByBrain(brainId)` which invokes the `TerminateByBrain` RPC. The Go service iterates all sandboxes for that brain, deletes their directories, then bulk-deletes the DB records.

---

## 4. API Endpoints

### 4.1 Sandbox Lifecycle

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| POST | `/api/clusters/{clusterId}/sandbox` | Provision sandbox | 202 Accepted + SandboxResponse |
| GET | `/api/clusters/{clusterId}/sandbox` | Get sandbox status | 200 OK or 404 |
| DELETE | `/api/clusters/{clusterId}/sandbox` | Terminate sandbox | 202 Accepted |
| POST | `/api/clusters/{clusterId}/sandbox/retry` | Retry failed provision | 202 Accepted + SandboxResponse |

### 4.2 Sandbox Operations (require status = active)

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| POST | `.../sandbox/pull` | Pull latest from remote | PullResponse (newCommit) |
| POST | `.../sandbox/checkout` | Switch branch | SandboxResponse |
| GET | `.../sandbox/branches` | List available branches | List\<String\> |
| GET | `.../sandbox/tree?path=` | Directory listing | List\<FileTreeEntryResponse\> |
| GET | `.../sandbox/file?path=` | File content | FileContentResponse |
| GET | `.../sandbox/log?limit=&offset=` | Git log (limit clamped to 200) | List\<GitCommitResponse\> |
| GET | `.../sandbox/blame?path=` | Git blame | List\<BlameLineResponse\> |
| GET | `.../sandbox/diff?from=&to=` | Git diff | Unified diff string |

### 4.3 Code Intelligence (proxy: sandbox-service for file, intelligence-service for analysis)

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| GET | `.../sandbox/structure?path=` | Code structure (symbols) | Map |
| GET | `.../sandbox/definition?path=&line=&col=` | Go to definition | Map |
| GET | `.../sandbox/references?path=&line=&col=` | Find references | Map |

These endpoints fetch file content from the sandbox-service via gRPC, then forward the content to the intelligence-service (Python/FastAPI) for tree-sitter analysis.

### 4.4 Global Sandbox Listing (for sidebar)

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| GET | `/api/sandboxes` | List all sandboxes across all brains | List\<SandboxResponse\> |

### 4.5 Request/Response DTOs

**ProvisionSandboxRequest:**
```json
{
  "branch": "main",       // optional, defaults to cluster's ProjectConfig.defaultBranch
  "shallow": true          // optional, defaults to true
}
```

The `repoUrl` is read from the cluster's `ProjectConfig`, not passed in the request.

**SandboxResponse:**
```json
{
  "id": "uuid",
  "clusterId": "uuid",
  "brainId": "uuid",
  "brainName": "string | null",
  "clusterName": "string | null",
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

`brainName` and `clusterName` are enriched by the Spring controller by joining to the cluster entity. They are nullable (null if the cluster has been deleted).

**CheckoutRequest:**
```json
{
  "branch": "feature/xyz"   // required, max 255 chars, pattern: ^[\w/.\-]+$
}
```

**Other response DTOs:** `PullResponse`, `GitCommitResponse`, `BlameLineResponse`, `FileContentResponse`, `FileTreeEntryResponse`.

---

## 5. Sidebar UI

A collapsible "Sandboxes" section in the sidebar, visible only when at least one sandbox exists.

```
┌──────────────────────┐
│  Home                │
│                      │
│  v BRAINS            │
│    Backend Eng       │
│    ML Research       │
│                      │
│  v THOUGHTS          │
│    Design Patterns   │
│                      │
│  v SANDBOXES (2)     │
│    * spring-framework│   <- green dot = active
│      Backend Eng     │   <- brain name, dimmed
│    o my-ml-project   │   <- yellow pulsing = cloning
│      ML Research     │
│                      │
│  Settings            │
│  Review Queue (3)    │
└──────────────────────┘
```

**Status indicators (Tailwind CSS classes):**
- Green dot (`bg-green-500`) = active
- Yellow pulsing dot (`bg-yellow-500 animate-pulse`) = cloning or indexing
- Red dot (`bg-red-500`) = error
- Grey dot (`bg-gray-500`) = terminating

**Display name:** `clusterName || repoUrl.split("/").pop()`

**Click action:** Navigate to `/brain/${brainId}/cluster/${clusterId}`.

### Provision Dialog

`ProvisionSandboxDialog` component triggered by "Provision Sandbox" button on the project cluster page:
- Branch input (default: `ProjectConfig.defaultBranch`)
- Shallow clone checkbox (default: checked, labeled "faster, less disk space")
- Repository URL shown read-only
- Error display on failure

### Terminate Confirmation

"This will delete the cloned repository from the server. Your notes and anchors will be preserved. You can re-provision later."

---

## 6. Storage Strategy

### 6.1 Directory Structure

```
/data/sandboxes/
  +-- {sandbox-uuid-1}/
  |   +-- repo/              <- cloned git repository
  +-- {sandbox-uuid-2}/
  |   +-- repo/
  +-- ...
```

UUID-based directory names avoid collisions and prevent information leakage. The root path defaults to `/data/sandboxes` (configurable via `SANDBOX_ROOT_PATH`).

### 6.2 Docker Compose

The sandbox-service runs as a separate container. The volume is mounted on sandbox-service, not the main app:

```yaml
sandbox-service:
  build:
    context: .
    dockerfile: sandbox-service/Dockerfile
  environment:
    DATABASE_URL: postgres://sandbox:sandbox@postgres:5432/sandbox?sslmode=disable
    SANDBOX_ROOT_PATH: /data/sandboxes
    SANDBOX_MAX_REPO_SIZE_MB: ${SANDBOX_MAX_REPO_SIZE_MB:-1000}
    SANDBOX_MAX_TOTAL_DISK_MB: ${SANDBOX_MAX_TOTAL_DISK_MB:-5120}
    SANDBOX_CLONE_TIMEOUT_SEC: ${SANDBOX_CLONE_TIMEOUT_SEC:-300}
    SANDBOX_MAX_CONCURRENT_CLONES: ${SANDBOX_MAX_CONCURRENT_CLONES:-2}
    SANDBOX_MAX_COUNT: ${SANDBOX_MAX_COUNT:-10}
    SANDBOX_STALE_DAYS: ${SANDBOX_STALE_DAYS:-30}
    GITHUB_PAT: ${GITHUB_PAT:-}
    GRPC_PORT: 50051
  volumes:
    - sandbox-data:/data/sandboxes
  healthcheck:
    test: ["CMD", "/app/grpc_health_probe", "-addr=:50051"]
    interval: 30s
    timeout: 5s
    start_period: 10s
    retries: 3
```

The main `app` container has no access to sandbox files — it accesses everything through gRPC. It depends on `sandbox-service: condition: service_healthy`.

### 6.3 Clone Strategy

Clone command: `git clone --branch <branch> --single-branch --no-tags [--depth 1] <url> <dir>`

After clone, git hooks are disabled: `git config core.hooksPath /dev/null`

- **Shallow clone** (default): `--depth 1` — minimal disk, fast. Limitations: no full log, blame limited to shallow commit.
- **Full clone** (user opt-in): full history for log, blame, diff. Larger disk footprint.

### 6.4 Disk Usage Tracking

Disk usage is calculated once after clone completes via `calculateDiskUsage()`, which walks the directory tree summing file sizes. The result is stored in `sandboxes.disk_usage_bytes`.

No periodic refresh scheduler exists — disk usage is a snapshot from clone time.

### 6.5 Cleanup Policy

`CleanupScheduler` runs daily at 3 AM UTC inside the Go sandbox-service:

1. Find sandboxes where `last_accessed_at < NOW() - SANDBOX_STALE_DAYS` and `status = 'active'`
2. Delete sandbox directory (with safety check: directory must be under sandbox root)
3. Delete database record

---

## 7. Security

### 7.1 URL Validation (SSRF Prevention)

Implemented in `sandbox-service/internal/service/ssrf.go`. Before cloning, the repository URL is validated:

1. **Protocol whitelist** — only `https://` (case-insensitive). Rejects all other schemes.
2. **Host blocklist** — rejects `localhost`, `host.docker.internal`, and any host ending in `.internal`.
3. **DNS resolution check** — resolves hostname and rejects if it resolves to loopback, private, link-local unicast, or link-local multicast addresses.

### 7.2 Directory Isolation

Path safety is implemented in two layers (defense-in-depth):

**sandbox-service** (`pathsafe.go`):
- Rejects absolute paths (starting with `/` or `\`)
- Rejects `..` in path
- Rejects `.git` and `.git/` access
- Resolves to absolute path and verifies it is under the repo directory

**Spring controller** (`SandboxController.validatePath()`):
- Rejects `..`, paths starting with `/`, `.git`, `.git/`

### 7.3 Git Operation Safety

- All git operations run in sandbox directory only, never in the application directory
- No push, commit, or write-to-remote operations exposed
- Git hooks disabled after clone: `git config core.hooksPath /dev/null`
- LFS not handled

---

## 8. Resource Limits and Quotas

| Limit | Docker Compose Default | Go Fallback | Environment Variable |
|-------|----------------------|-------------|---------------------|
| Max single repo size | 1000 MB | 10000 MB | `SANDBOX_MAX_REPO_SIZE_MB` |
| Max total disk (all sandboxes) | 5120 MB | 307200 MB | `SANDBOX_MAX_TOTAL_DISK_MB` |
| Clone timeout | 300 sec | 300 sec | `SANDBOX_CLONE_TIMEOUT_SEC` |
| Max concurrent clones | 2 | 2 | `SANDBOX_MAX_CONCURRENT_CLONES` |
| Inactive cleanup threshold | 30 days | 30 days | `SANDBOX_STALE_DAYS` |
| Max sandboxes total | 10 | 1000 | `SANDBOX_MAX_COUNT` |

The Go fallback defaults are intentionally permissive; the docker-compose file applies tighter production defaults.

### Enforcement

All enforcement is in the Go sandbox-service:

- **Before provisioning:** `store.CountByStatuses()` checks active sandbox count. `store.SumDiskUsageActive()` checks total disk usage. Rejected via gRPC `RESOURCE_EXHAUSTED` status, mapped to HTTP 409 Conflict by the Spring controller.
- **After clone:** Repo size checked via `calculateDiskUsage()` against `MaxRepoSizeBytes()`. If exceeded, directory is deleted and sandbox set to error.
- **Clone timeout:** `context.WithTimeout()` on the clone operation.
- **Concurrent clones:** Channel-based semaphore (`chan struct{}`) with capacity `MaxConcurrentClones`. When full, sandbox immediately set to error with message "Too many concurrent clones."

---

## 9. Monitoring

### 9.1 Health Check

- sandbox-service implements gRPC health check protocol
- Docker healthcheck: `/app/grpc_health_probe -addr=:50051` (interval 30s, timeout 5s, 3 retries)
- Main app depends on sandbox-service health (`condition: service_healthy`)

### 9.2 Logging

The Go sandbox-service uses structured logging via `log/slog`. Key log events:
- `sandbox ready` (with disk_mb)
- `clone failed` / `clone complete`
- `sandbox terminated`
- `cleanup complete` (with cleaned count)
- Error conditions (quota exceeded, path traversal attempts, etc.)

No Micrometer metrics are currently exposed.

---

## 10. Architecture

### 10.1 Microservice via gRPC

```
Browser  --(REST)-->  Spring Boot App  --(gRPC)-->  sandbox-service (Go)
                     (SandboxController)            (SandboxServer)
                     (SandboxGrpcClient)            (SandboxService)
                                                    (GitService)
                                                    (Store / pgx)
                                                         |
                    main PostgreSQL  <--no FK-->  sandbox PostgreSQL
                    (brainbook DB)                  (sandbox DB)
```

For code intelligence, the Spring controller creates a three-service call chain:
```
Browser -> Spring (SandboxController)
             -> sandbox-service (gRPC: GetFileContent)
             -> intelligence-service (HTTP: code structure / definition / references)
```

### 10.2 Components

**Proto definition** (`proto/sandbox/v1/sandbox.proto`):
- 17 RPCs: 6 lifecycle, 6 git operations, 1 stateless git, 2 file operations, plus health check
- Go and Java code generation configured

**Spring Boot app (thin REST-to-gRPC proxy):**
- `SandboxGrpcClient` (`config/SandboxGrpcClient.java`) — Spring `@Service` bean, blocking gRPC stub at `${SANDBOX_SERVICE_HOST:localhost:50051}`, exception mapping (gRPC status codes -> Spring exceptions), graceful shutdown
- `SandboxController` (`controller/SandboxController.java`) — REST endpoints, request validation, response enrichment (joins cluster/brain names from main DB), path validation

**Go sandbox-service:**
- `SandboxService` (`service/sandbox.go`) — core business logic: provision, terminate, retry, pull, checkout, list, file tree, file content, detect default branch. Clone concurrency via channel semaphore.
- `GitService` (`service/git.go`) — native git CLI wrapper via `exec.CommandContext`. Operations: clone, pull, checkout, list branches, log, blame, diff, head commit, detect default branch. GitHub PAT injection for private repos.
- `CleanupScheduler` (`service/cleanup.go`) — daily stale sandbox cleanup at 3 AM UTC
- `Store` (`store/store.go`) — PostgreSQL access via pgx pool, embedded golang-migrate migrations
- `ValidateRepoURL` (`service/ssrf.go`) — SSRF prevention
- `ResolveSafePath` (`service/pathsafe.go`) — path traversal prevention
- `DetectLanguage` (`service/language.go`) — file extension to language mapping

### 10.3 Why Go + Native Git

1. **Process isolation** — git operations (cloning, file I/O) are fully isolated from the Spring Boot JVM
2. **Native git** — faster than JGit for large repos, full feature parity, simpler blame/log parsing
3. **Independent scaling** — sandbox-service can scale independently of the main app
4. **Independent database** — sandbox data lifecycle decoupled from main app schema
5. **Simpler resource management** — Go goroutines + channel semaphore for clone concurrency

---

## 11. Frontend Implementation

### Hooks

**`useSandbox(clusterId)`** (`lib/hooks/useSandbox.ts`):
- State: `sandbox` (or null), `loading`
- Mutations: `provision(body?)`, `terminate()`, `pull()`, `checkout(branch)`, `retry()`
- Query key: `["sandbox", clusterId]`
- **Polling:** `refetchInterval` returns 3000ms during transitional states (`cloning`, `indexing`, `terminating`) — replaces SSE
- **Sidebar sync:** `useEffect` invalidates `["sandboxes"]` query when sandbox status changes
- **Cascading invalidation:** on mutations, invalidates 8 query keys: sandbox, sandboxes, sandbox-tree, sandbox-file, sandbox-blame, sandbox-log, code-structure, neuron-anchors

**`useSandboxList()`** (`lib/hooks/useSandboxList.ts`):
- State: `sandboxes` (array), `loading`
- Query key: `["sandboxes"]`

### TypeScript Types (`types/index.ts`)

```typescript
type SandboxStatus = "cloning" | "indexing" | "active" | "error" | "terminating";

interface Sandbox {
  id: string;
  clusterId: string;
  brainId: string;
  brainName: string | null;
  clusterName: string | null;
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
```

Additional types: `PullResponse`, `GitCommit`, `BlameLine`, `FileTreeEntry`, `FileContent`, `CodeSymbol`, `CodeLocation`, `CodeStructureResponse`, `CodeDefinitionResponse`, `CodeReferencesResponse`.

### Key Components

- `ProvisionSandboxDialog` (`components/project/ProvisionSandboxDialog.tsx`) — branch input, shallow clone checkbox, error display
- `SandboxStatusBar` — status indicator, branch, commit, pull/terminate buttons
- `FileTreePanel` (`components/project/FileTreePanel.tsx`) — lazy-loading file tree with folder expansion
- `CodeViewer` (`components/project/CodeViewer.tsx`) — CodeMirror 6, syntax highlighting, blame gutter, go-to-definition

### API Client (`lib/api.ts`)

14 sandbox endpoints + 3 code intelligence endpoints in the `api.sandbox` object. All lifecycle, git operations, file operations, and global listing endpoints are wired up.

---

## 12. Future Enhancements

| Feature | Status | Notes |
|---------|--------|-------|
| **Full-text codebase search** | Not implemented | Originally specced but no search RPC exists |
| **Per-repo credentials** | Not implemented | Currently only one global GitHub PAT |
| **SSH key support** | Not implemented | Only HTTPS + PAT supported |
| **Unshallow upgrade** | Not implemented | `git fetch --unshallow` not exposed |
| **Sandbox snapshots** | Not implemented | Save/restore sandbox state |
| **Sandbox resource dashboard** | Not implemented | Admin page for disk usage, cleanup history |
| **Disk usage refresh scheduler** | Not implemented | Disk usage only measured once after clone |
| **Metrics / Micrometer** | Not implemented | Go service uses slog; no metrics exported |
| **SSE / WebSocket for status** | Not implemented | Frontend uses 3-second polling instead |
| **Submodule prevention** | Not implemented | `--no-recurse-submodules` not passed on clone |
| **Host allowlist for SSRF** | Not implemented | Configurable allowed git hosting domains |
