# Project Cluster — Implementation Plan

## Overview

A code-anchored knowledge graph feature for BrainBook. Users browse read-only codebases and attach neurons (notes) to specific file lines, creating linked annotations for understanding vibe-coded apps, development logging, and open-source study.

**Spec references:**
- Feature spec: [`specs/06-project-cluster.md`](specs/06-project-cluster.md)
- Sandbox infrastructure (future): [`specs/future/sandbox-management.md`](specs/future/sandbox-management.md)
- Superseded draft: [`specs/future/project-cluster.md`](specs/future/project-cluster.md)

## Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Foundation | **Done** | DB migration, entities, repositories, services, controllers |
| Phase 2: URL Browse Mode | Pending | GitHub API proxy, frontend code viewer with anchoring |
| Phase 3: Sandbox Mode | Pending | JGit, clone/terminate, anchor reconciliation |
| Phase 4: Code Intelligence | Pending | Tree-sitter in intelligence service |
| Phase 5: Polish | Pending | Git views, orphan management, keyboard shortcuts |

---

## Phase 1: Foundation (Backend)

> **Status: Done** — All tests passing (295/295).

Establishes the domain model, database schema, and API endpoints for project clusters and neuron anchors.

### Steps

| # | Task | Files | Spec Reference |
|---|------|-------|----------------|
| 1 | Flyway migration V26 | `app/src/main/resources/db/migration/V26__add_project_cluster_tables.sql` | [Spec §2.4](specs/06-project-cluster.md#24-flyway-migration-v26) |
| 2 | Remove PROJECT from `ClusterType.isUnique()` | `app/src/main/java/com/wliant/brainbook/model/ClusterType.java` | [Spec §2.1](specs/06-project-cluster.md#21-modified-entities) |
| 3 | `AnchorStatus` enum (ACTIVE, DRIFTED, ORPHANED) | `app/src/main/java/com/wliant/brainbook/model/AnchorStatus.java` | [Spec §2.2 NeuronAnchor](specs/06-project-cluster.md#22-new-entities) |
| 4 | `ProjectConfig` entity + repository + DTOs | `model/ProjectConfig.java`, `repository/ProjectConfigRepository.java`, `dto/ProjectConfigResponse.java`, `dto/UpdateProjectConfigRequest.java` | [Spec §2.2 ProjectConfig](specs/06-project-cluster.md#22-new-entities) |
| 5 | `ProjectConfigService` + `ProjectConfigController` | `service/ProjectConfigService.java`, `controller/ProjectConfigController.java` | [Spec §4.2](specs/06-project-cluster.md#42-project-config) |
| 6 | Extend cluster creation for project type | `dto/CreateClusterRequest.java` (add `repoUrl`, `defaultBranch`), `service/ClusterService.java` (create `ProjectConfig` in transaction) | [Spec §4.1](specs/06-project-cluster.md#41-project-cluster-lifecycle) |
| 7 | `NeuronAnchor` entity + repository + DTOs | `model/NeuronAnchor.java`, `repository/NeuronAnchorRepository.java`, `dto/NeuronAnchorResponse.java`, `dto/CreateNeuronAnchorRequest.java`, `dto/UpdateNeuronAnchorRequest.java` | [Spec §2.2 NeuronAnchor](specs/06-project-cluster.md#22-new-entities) |
| 8 | `AnchorService` (CRUD + hash normalization) | `service/AnchorService.java` — includes `normalizeAndHash()`, `extractLines()`, `validateLineRange()`, batch `getByNeuronIds()` | [Spec §3](specs/06-project-cluster.md#3-neuron-anchoring-model) |
| 9 | `NeuronAnchorController` | `controller/NeuronAnchorController.java` — GET list/file/orphaned, DELETE, confirm-drift. POST/PATCH return 501 until Phase 2. | [Spec §4.7](specs/06-project-cluster.md#47-neuron-anchors) |
| 10 | Extend neuron creation with optional anchor | `dto/NeuronRequest.java` (add inner `AnchorRequest` record), `dto/NeuronResponse.java` (add `anchor` field), `service/NeuronService.java` (batch anchor fetch in `toResponseBatch`) | [Spec §4.8](specs/06-project-cluster.md#48-atomic-neuron--anchor-creation) |

### Code Review Fixes Applied

After initial implementation, a 3-agent code review identified and fixed:
- **N+1 anchor queries** in `toResponseBatch()` — added batch fetch via `findByNeuronIdIn()`
- **Dead code** in `NeuronService.create()` — removed unused `CreateNeuronAnchorRequest` construction
- **Silent exception swallowing** — added `logger.debug()` for anchor lookup failures
- **SHA-256 hex encoding** — replaced hand-rolled loop with `HexFormat.of().formatHex()`
- **Controller stubs** — changed from 500 `UnsupportedOperationException` to 501 `NOT_IMPLEMENTED`
- **Missing validation** — added `endLine >= startLine` check, extracted `validateLineRange()`
- **Wrong exception types** — changed validation errors from `ConflictException` (409) to `IllegalArgumentException` (400)
- **Missing `@NotBlank`** on `AnchorRequest.filePath`

---

## Phase 2: URL Browse Mode (Backend + Frontend)

> **Status: Pending**

Delivers the first usable UI — users can browse GitHub repos and create anchored neurons.

### Backend

| # | Task | New Files | Spec Reference |
|---|------|-----------|----------------|
| 11 | `UrlBrowseService` — GitHub API proxy | `service/UrlBrowseService.java` — parse GitHub URL → extract owner/repo, proxy tree/file/branches API with Caffeine caching (tree: 1min, file: 5min). Optional `GITHUB_API_TOKEN` for rate limits. | [Spec §4.3](specs/06-project-cluster.md#43-file-browsing--url-browse-mode-github-api-proxy), [Spec §8.2](specs/06-project-cluster.md#82-url-browse-mode) |
| 11b | `UrlBrowseController` | `controller/UrlBrowseController.java` — `@RequestMapping("/api/clusters/{clusterId}/browse")`, GET /tree, /file, /branches | [Spec §4.3](specs/06-project-cluster.md#43-file-browsing--url-browse-mode-github-api-proxy) |

### Frontend

| # | Task | New Files | Spec Reference |
|---|------|-----------|----------------|
| 12 | TypeScript types | Modify `web/src/types/index.ts` — add `ProjectConfig`, `NeuronAnchor`, `AnchorStatus`, `FileTreeEntry`, `FileContent`, `GitCommit`, `BlameLine`, `CodeSymbol`, `Sandbox`, `SandboxStatus` | [Spec §9.4](specs/06-project-cluster.md#94-typescript-types) |
| 13 | API client extensions | Modify `web/src/lib/api.ts` — add namespaced `api.projectConfig.*`, `api.neuronAnchors.*`, `api.browse.*` | [Spec §9.5](specs/06-project-cluster.md#95-api-client-extensions) |
| 14 | Data hooks | `web/src/lib/hooks/useProjectConfig.ts`, `useFileTree.ts`, `useFileContent.ts`, `useNeuronAnchors.ts` | [Spec §9.2](specs/06-project-cluster.md#92-new-hooks) |
| 15 | `ProjectClusterView` | `web/src/components/project/ProjectClusterView.tsx` — three-panel layout (file tree | code viewer | neuron panel). Modify `web/src/app/brain/[brainId]/cluster/[clusterId]/page.tsx` to replace "coming soon" placeholder. | [Spec §5.1](specs/06-project-cluster.md#51-project-cluster-page-layout) |
| 16 | `FileTreePanel` | `web/src/components/project/FileTreePanel.tsx` — recursive tree, lazy loading, folder/file icons from lucide-react | [Spec §5.4](specs/06-project-cluster.md#54-component-breakdown) |
| 17 | `CodeViewer` | `web/src/components/project/CodeViewer.tsx` — wraps existing CodeMirrorEditor in read-only mode, language detection from file extension, line selection for anchor creation | [Spec §5.5](specs/06-project-cluster.md#55-code-viewer-details) |
| 18 | `NeuronPanel` | `web/src/components/project/NeuronPanel.tsx` — lists anchored neurons for current file, click to scroll code viewer, "Needs Review" section for drifted/orphaned | [Spec §5.4](specs/06-project-cluster.md#54-component-breakdown) |
| 19 | `CreateAnchorDialog` | `web/src/components/project/CreateAnchorDialog.tsx` — Radix Dialog after line selection, neuron title input, atomic neuron+anchor creation | [Spec §5.4](specs/06-project-cluster.md#54-component-breakdown) |
| 20 | `AnchorGutter` | `web/src/components/project/AnchorGutter.ts` — CodeMirror 6 gutter extension, colored dot markers at anchored lines | [Spec §5.5](specs/06-project-cluster.md#55-code-viewer-details) |

### Tests

| # | Task | Files |
|---|------|-------|
| 20b | Backend: `UrlBrowseServiceTest` | Mock GitHub API with WireMock, test tree/file/branches parsing |
| 20c | Frontend: hook + component tests | `useNeuronAnchors.test.ts`, `ProjectClusterView.test.tsx`, MSW handlers for new endpoints |

### Verification

- Open project cluster in UI → see file tree from GitHub API
- Click a file → see syntax-highlighted code
- Select lines → create anchored neuron → see gutter marker
- Neuron panel shows the anchored neuron

---

## Phase 3: Sandbox Mode (Backend + Frontend)

> **Status: Pending** — Depends on Phase 2.

Adds server-side git clone, full git operations, and automatic anchor reconciliation.

### Backend

| # | Task | New Files | Spec Reference |
|---|------|-----------|----------------|
| 21 | Sandbox entity + JGit dependency | `model/Sandbox.java`, `model/SandboxStatus.java`, `repository/SandboxRepository.java`, `dto/SandboxResponse.java`, `dto/ProvisionSandboxRequest.java`. Add JGit to `build.gradle.kts`. Add `app.sandbox.*` config to `application.yml`. | [Sandbox spec §3](specs/future/sandbox-management.md#3-data-model), [Sandbox spec §10](specs/future/sandbox-management.md#10-architecture-decision-jgit-vs-git-cli) |
| 22 | `GitOperationService` | `service/GitOperationService.java` — JGit wrapper: `cloneRepository`, `pull`, `checkout`, `listBranches`, `log`, `blame`, `diff`, `getChangedFiles` | [Spec §7](specs/06-project-cluster.md#7-git-operations), [Sandbox spec §11](specs/future/sandbox-management.md#11-backend-service-design) |
| 23 | `SandboxService` + `SandboxController` | `service/SandboxService.java` (provision, terminate, file serving, URL validation/SSRF check), `controller/SandboxController.java` (lifecycle + file + git + SSE endpoints), `config/SandboxConfig.java`. Add `sandbox-data` volume to `docker-compose.app.yml`. | [Sandbox spec §4](specs/future/sandbox-management.md#4-api-endpoints), [Sandbox spec §7](specs/future/sandbox-management.md#7-security) |
| 24 | Anchor reconciliation | Modify `service/AnchorService.java` — add `reconcile(clusterId, oldCommit, newCommit)` implementing the 4-phase algorithm: hash check → exact text search (auto-update) → fuzzy LCS (drifted) → rename detection (orphaned). Called after pull/checkout. | [Spec §3.4](specs/06-project-cluster.md#34-re-matching-algorithm-on-git-pull-sandbox-mode-only) |

### Frontend

| # | Task | New Files | Spec Reference |
|---|------|-----------|----------------|
| 25a | Sandbox hooks | `web/src/lib/hooks/useSandbox.ts`, `web/src/lib/hooks/useSandboxList.ts` | [Spec §9.2](specs/06-project-cluster.md#92-new-hooks) |
| 25b | Sandbox UI | `web/src/components/project/ProvisionSandboxDialog.tsx`, `web/src/components/project/SandboxStatusBar.tsx` | [Spec §5.2](specs/06-project-cluster.md#52-sandbox-provisioned-layout) |
| 25c | Update `ProjectClusterView` | Add `useSandbox` hook, show Provision/Pull/Terminate buttons, route requests to sandbox endpoints when active | [Spec §5.3](specs/06-project-cluster.md#53-mode-capabilities-matrix) |
| 25d | Sidebar sandbox section | Modify `web/src/components/layout/Sidebar.tsx` — add sandboxes section using `useSandboxList`, status indicators | [Sandbox spec §5](specs/future/sandbox-management.md#5-sidebar-ui-concept) |
| 25e | API client | Modify `web/src/lib/api.ts` — add `api.sandbox.*` namespace | [Spec §9.5](specs/06-project-cluster.md#95-api-client-extensions) |

### Tests

| # | Task | Approach |
|---|------|----------|
| 25f | `AnchorService` reconciliation | Unit tests with synthetic file content — test each phase independently. Edge cases: file deleted, renamed, content partially changed, identical content at multiple locations. |
| 25g | `GitOperationService` | Integration tests: create temp git repos in `@BeforeEach` via JGit `InitCommand`, create commits, verify log/blame/diff. |

### Verification

- Provision sandbox → verify clone completes (status transitions: cloning → active)
- Pull → verify anchor reconciliation runs (auto-updated, drifted, orphaned counts)
- Terminate sandbox → verify directory cleanup
- Sidebar shows active sandboxes with status indicators

---

## Phase 4: Code Intelligence

> **Status: Pending** — Depends on Phase 3.

Adds tree-sitter-powered code navigation (symbol outline, go-to-definition, find references).

### Intelligence Service (Python)

| # | Task | New Files | Spec Reference |
|---|------|-----------|----------------|
| 26a | Tree-sitter endpoints | `intelligence-service/src/routers/code_intelligence.py` — POST `/api/code/structure`, `/api/code/definition`, `/api/code/references` | [Spec §6.2](specs/06-project-cluster.md#62-intelligence-service-endpoints-new) |
| 26b | Pydantic schemas | `intelligence-service/src/schemas/code_intelligence.py` — request/response models | [Spec §6.3](specs/06-project-cluster.md#63-symbol-model) |
| 26c | Tree-sitter parser | `intelligence-service/src/agents/code_analyzer.py` — direct tree-sitter usage (not LangGraph), symbol extraction, definition/reference lookup | [Spec §6.1](specs/06-project-cluster.md#61-architecture) |
| 26d | Dependencies | Modify `intelligence-service/pyproject.toml` — add `tree-sitter` + grammar packages for Java, Python, TypeScript, Go, Rust, C/C++ | [Spec §6.4](specs/06-project-cluster.md#64-supported-languages-v1) |
| 26e | Register router | Modify `intelligence-service/src/main.py` | — |

### Backend Proxy

| # | Task | Files |
|---|------|-------|
| 26f | Proxy endpoints | Modify `service/IntelligenceService.java` — add `getStructure()`, `getDefinition()`, `getReferences()`. Modify `controller/SandboxController.java` — add GET /structure, /definition, /references. | [Spec §4.6](specs/06-project-cluster.md#46-code-intelligence-sandbox-mode) |

### Frontend

| # | Task | New Files | Spec Reference |
|---|------|-----------|----------------|
| 26g | Code structure hook | `web/src/lib/hooks/useCodeStructure.ts` | [Spec §9.2](specs/06-project-cluster.md#92-new-hooks) |
| 26h | `FileStructurePanel` | `web/src/components/project/FileStructurePanel.tsx` — symbol tree, click to jump to line | [Spec §5.4](specs/06-project-cluster.md#54-component-breakdown) |
| 26i | `QuickOpenDialog` | `web/src/components/project/QuickOpenDialog.tsx` — Ctrl+P, fuzzy search file names | [Spec §5.4](specs/06-project-cluster.md#54-component-breakdown) |
| 26j | Go-to-definition | CodeMirror extension for Ctrl+Click → call definition API → navigate to file:line | [Spec §5.5](specs/06-project-cluster.md#55-code-viewer-details) |

### Tests

| # | Task | Approach |
|---|------|----------|
| 26k | Intelligence service | pytest with sample source files in Java, Python, TypeScript, Go. Verify symbol extraction, definition finding. Edge cases: empty files, syntax errors. |

### Verification

- Open a file → see symbol outline in FileStructurePanel
- Ctrl+Click on a function call → navigates to its definition
- Ctrl+P → quick open dialog with fuzzy file search

---

## Phase 5: Polish

> **Status: Pending** — Depends on Phase 3 (some items can start after Phase 2).

### Components

| # | Task | New Files | Spec Reference |
|---|------|-----------|----------------|
| 27 | `BranchSelector` | `web/src/components/project/BranchSelector.tsx` — dropdown, calls sandbox checkout | [Spec §5.4](specs/06-project-cluster.md#54-component-breakdown) |
| 28 | `GitLogPanel` | `web/src/components/project/GitLogPanel.tsx` — paginated commit list (SHA, author, date, message) | [Spec §5.4](specs/06-project-cluster.md#54-component-breakdown) |
| 29 | `BlameView` | `web/src/components/project/BlameView.tsx` — inline gutter annotations showing commit info per line | [Spec §5.4](specs/06-project-cluster.md#54-component-breakdown) |
| 30 | `DiffView` | `web/src/components/project/DiffView.tsx` — unified diff rendering between two refs | [Spec §5.4](specs/06-project-cluster.md#54-component-breakdown) |
| 31 | `OrphanList` | `web/src/components/project/OrphanList.tsx` — re-anchor, confirm drift, dismiss, delete actions | [Spec §3.6](specs/06-project-cluster.md#36-orphan-management) |

### Infrastructure

| # | Task | Files | Spec Reference |
|---|------|-------|----------------|
| 32 | `SandboxCleanupScheduler` | `service/SandboxCleanupScheduler.java` — `@Scheduled` daily, terminate sandboxes not accessed in N days | [Sandbox spec §6.5](specs/future/sandbox-management.md#65-cleanup-policy) |
| 33 | Keyboard shortcuts | Ctrl+P (quick open), Ctrl+Shift+O (file structure), Ctrl+G (go to line), Ctrl+Click (go to definition), Ctrl+Shift+F (search), Escape (close panels) | [Spec §5.6](specs/06-project-cluster.md#56-keyboard-shortcuts) |

### Spec Updates

| # | Task | Files |
|---|------|-------|
| 34 | Update domain model spec | `specs/01-domain-model.md` — add ProjectConfig and NeuronAnchor entities |
| 35 | Update API spec | `specs/02-api.md` — add project-config, neuron-anchor, browse, sandbox endpoints |
| 36 | Update frontend spec | `specs/03-frontend.md` — add project components, hooks, routes |

### Verification (Full E2E)

1. Create project cluster with GitHub URL
2. Browse files in URL mode → see file tree, syntax-highlighted code
3. Select lines → create anchored neuron → gutter marker appears
4. Provision sandbox → clone completes
5. Pull → anchor reconciliation runs → drifted/orphaned anchors shown
6. Open symbol outline → click to jump
7. Ctrl+Click → go to definition
8. View blame, log, diff panels
9. Manage orphaned anchors (re-anchor, confirm drift, dismiss)
10. Terminate sandbox → cleanup
11. Docker compose rebuild and test: `docker compose --env-file .env -f docker-compose.infra.yml -f docker-compose.app.yml up -d --build`

---

## Architecture Summary

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Next.js    │────>│   Spring Boot    │────>│ Intelligence Service│
│  (frontend)  │     │   (backend)      │     │  (Python/FastAPI)   │
│              │     │                  │     │                     │
│ ProjectClust │     │ ProjectConfig    │     │ tree-sitter parser  │
│ erView       │     │ Service          │     │ (symbol extraction, │
│ FileTreePanel│     │                  │     │  go-to-definition,  │
│ CodeViewer   │     │ AnchorService    │     │  find references)   │
│ NeuronPanel  │     │ (CRUD + reconcil)│     │                     │
│ AnchorGutter │     │                  │     └─────────────────────┘
│              │     │ UrlBrowseService │────> GitHub API
│              │     │ (GitHub proxy)   │
│              │     │                  │
│              │     │ SandboxService   │────> JGit (local clone)
│              │     │ GitOperationServ │
└─────────────┘     └──────────────────┘
                            │
                    ┌───────┴───────┐
                    │  PostgreSQL   │
                    │  project_configs
                    │  neuron_anchors
                    │  sandboxes    │
                    └───────────────┘
```

## Key Design Decisions

| Decision | Rationale | Spec Reference |
|----------|-----------|----------------|
| No `browseMode` column — derived from sandbox existence | Avoids state desync | [Spec §2.2 Design note](specs/06-project-cluster.md#22-new-entities) |
| Atomic neuron + anchor creation | Prevents partial failures | [Spec §4.8](specs/06-project-cluster.md#48-atomic-neuron--anchor-creation) |
| Auto-accept exact drift, only confirm fuzzy | Reduces noise — identical content at new lines is safe | [Spec §3.3](specs/06-project-cluster.md#33-anchor-status-lifecycle) |
| GitHub-only for URL browse in V1 | Avoids multi-provider maintenance overhead | [Spec §8.3](specs/06-project-cluster.md#83-url-provider-detection) |
| Tree-sitter in intelligence service (Python) | Mature bindings; latency mitigated by caching | [Spec §6.1](specs/06-project-cluster.md#61-architecture) |
| JGit for git operations | Pure Java, no Docker image changes | [Sandbox spec §10](specs/future/sandbox-management.md#10-architecture-decision-jgit-vs-git-cli) |
| Max 100 lines per anchor | Bounds `anchoredText` storage and re-matching cost | [Spec §2.2 NeuronAnchor constraints](specs/06-project-cluster.md#22-new-entities) |
| Private repo credentials deferred | Simplifies V1 scope significantly | [Sandbox spec §3.2](specs/future/sandbox-management.md#32-private-repo-credentials-deferred) |

## Environment Variables (New)

| Variable | Default | Phase | Description |
|----------|---------|-------|-------------|
| `SANDBOX_BASE_DIR` | `/data/sandboxes` | 3 | Base directory for cloned repos |
| `SANDBOX_MAX_REPO_SIZE_MB` | `500` | 3 | Maximum allowed repo size |
| `SANDBOX_CLONE_TIMEOUT_SEC` | `300` | 3 | Clone operation timeout |
| `SANDBOX_STALE_DAYS` | `30` | 5 | Days before auto-cleanup |
| `ANCHOR_FUZZY_THRESHOLD` | `0.7` | 3 | LCS similarity threshold for fuzzy re-matching |
| `GITHUB_API_TOKEN` | (empty) | 2 | Optional GitHub token for higher rate limits |
