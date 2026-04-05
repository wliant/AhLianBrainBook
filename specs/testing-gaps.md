# Testing Gap Analysis

**Generated:** 2026-04-05
**Scope:** Full System
**Test Counts:** App: 342 | Web: 193 | Intelligence Service: 49 | E2E: 196

## Executive Summary

BrainBook has a solid testing foundation with 780 tests across four sub-projects, covering the core CRUD operations for brains, clusters, neurons, tags, links, revisions, templates, reminders, notifications, and spaced repetition. The App layer is the strongest with 342 tests providing both unit and integration coverage for all services and controllers. E2E tests are comprehensive at 196 tests covering browser flows, API validation, and cross-cutting concerns like dark mode, caching, and keyboard shortcuts.

The biggest risk areas are: **(1) Neuron Sharing** — a fully specified feature (12 requirements) with zero test coverage across all layers, meaning share link generation, expiration, public access, and revocation are completely untested. **(2) Todo Cluster** — a complex feature (24 requirements) with no dedicated test file in app or web layers; only E2E data population touches it indirectly. **(3) Project Cluster / Sandbox** — the most complex feature area (49+ requirements) has minimal test coverage limited to URL browse service unit tests and a few web component tests, with no integration tests for sandbox provisioning, anchor reconciliation, or git operations. **(4) Settings & App Config** — no dedicated service or controller tests for AppSettings CRUD.

Top 3 priorities for test investment: (1) Add Neuron Sharing tests across all layers immediately — untested public access is a security risk. (2) Build Todo Cluster service/controller integration tests for metadata CRUD, system reminder auto-creation, and task creation flow. (3) Add Sandbox management integration tests for provisioning lifecycle, resource limits, and SSRF prevention.

## Feature Coverage Heatmap

| Feature Area | Specs | App Tests | Web Tests | IS Tests | E2E Tests | Overall |
|---|---|---|---|---|---|---|
| Brain CRUD | 01,02,05 | 14 | 3 | -- | 6 | Full |
| Cluster Management | 01,02,03,05 | 29 | 2 | -- | 7 | Full |
| Neuron CRUD | 01,02,03,05 | 40 | 2 | -- | 15 | Full |
| Rich Text Editor | 01,03,05 | -- | 26 | -- | 4 | Partial |
| Tags / Links | 01,02,05 | 31 | -- | -- | 12 | Full |
| Attachments | 01,02,04,05 | 3 | 4 | -- | 6 | Partial |
| Favorites / Pinning | 03,05 | (in neuron) | -- | -- | 4+5 | Full |
| Trash / Soft Delete | 03,05 | (in neuron) | -- | -- | 5 | Full |
| Revisions | 01,02,03,05 | 21 | 4 | -- | 8 | Full |
| Thoughts | 01,02,03 | 12 | 4 | -- | 15 | Full |
| Templates | 01,02 | 10 | -- | -- | 5 | Full |
| Reminders | 01,02,03,05 | 22 | 13 | -- | 15 | Full |
| Notifications | 01,02,03,05 | 6 | 7 | -- | 10 | Full |
| Settings | 01,02,03 | -- | -- | -- | -- | None |
| Import / Export | 02,05 | 6 | -- | -- | 3 | Partial |
| Full-Text Search | 02,03,05 | 11 | -- | -- | 5 | Full |
| Knowledge Graph | 03,05 | -- | 6 | -- | 3 | Partial |
| Spaced Repetition | 01,02,03,05 | 40 | 16 | -- | 16 | Full |
| Neuron Sharing | 01,02,03,05 | -- | -- | -- | -- | **None** |
| AI Research Cluster | 01,02,03,05 | 14 | 2 | 4 | -- | Partial |
| Project Cluster | 06 | 15 | 15 | 15 | -- | Partial |
| Sandbox Management | future | -- | 5 | -- | -- | Partial |
| Todo Cluster | 08 | -- | -- | -- | 1* | **None** |
| AI Service | 07 | 4 | 7 | 49 | 4 | Partial |
| Infrastructure | 04 | 11 | -- | -- | 5 | Partial |
| Frontend Nav / UI | 03 | -- | 4 | -- | 14 | Partial |
| Defects (Fixed) | defects/* | -- | -- | -- | -- | None |

Legend: Full = all key paths tested, Partial = happy path only or missing layers, None = no tests
*Todo cluster only touched indirectly by test_00_data_population

## Requirement Traceability Matrix

### Spec 01: Domain Model
| Req ID | Requirement | Covering Tests | Status |
|---|---|---|---|
| SPEC-1.1.1 | Brain required fields | BrainServiceTest::createBrain_savesAndReturns | Covered |
| SPEC-1.2.1 | Cluster required fields | ClusterServiceTest::createCluster_savesAndReturns | Covered |
| SPEC-1.2.2 | Cluster type constraint (knowledge, ai-research, project, todo) | ClusterServiceTest::createAiResearchCluster_savesWithType, ClusterControllerIntegrationTest::createProjectCluster_returnsCreated | Covered |
| SPEC-1.2.3 | Cluster status constraint (generating, ready) | -- | UNCOVERED |
| SPEC-1.2.4 | Partial unique index: one ai-research per brain | ClusterServiceTest::createDuplicateAiResearchCluster_throws | Covered |
| SPEC-1.2.5 | Todo clusters unique per brain | -- | UNCOVERED |
| SPEC-1.2.6 | Todo clusters auto-named "Tasks" | -- | UNCOVERED |
| SPEC-1.2.7 | Multiple project/knowledge clusters allowed | ClusterServiceTest::createProjectCluster_multipleAllowed | Covered |
| SPEC-1.3.1 | Neuron required fields | NeuronServiceTest::createNeuron_savesAndReturns | Covered |
| SPEC-1.3.2 | Neuron contentJson v2 sections format | -- | Partial (tested via E2E data population) |
| SPEC-1.5.1 | Tags globally unique by name | TagServiceTest::createTag_savesAndReturns | Covered |
| SPEC-1.5.2 | neuron_tags cascade delete | test_04_tags::test_tag_cascade_on_neuron_delete | Covered |
| SPEC-1.5.3 | brain_tags cascade delete | -- | UNCOVERED |
| SPEC-1.7.1 | NeuronLink required fields | NeuronLinkServiceTest::createLink_savesAndReturns | Covered |
| SPEC-1.7.2 | NeuronLink unique constraint | NeuronLinkServiceTest::createLink_duplicate_throws | Covered |
| SPEC-1.7.3 | NeuronLink no self-links | NeuronLinkServiceTest::createLink_selfLink_throws | Covered |
| SPEC-1.6.1 | Attachment required fields | AttachmentServiceTest::upload_savesAttachment | Covered |
| SPEC-1.8.1 | NeuronRevision required fields | RevisionServiceTest::createRevision_savesSnapshot | Covered |
| SPEC-1.9.1 | Thought required fields | ThoughtServiceTest::createThought_savesAndReturns | Covered |
| SPEC-1.9.2 | Thought join tables cascade | -- | UNCOVERED |
| SPEC-1.10.1 | Template required fields | TemplateServiceTest::createTemplate_savesAndReturns | Covered |
| SPEC-1.11.1 | Reminder required fields | ReminderServiceTest::createReminder_once_savesAndReturns | Covered |
| SPEC-1.11.2 | Reminder partial index on trigger_at | -- | UNCOVERED |
| SPEC-1.11.3 | System reminders excluded from GET /api/reminders | -- | UNCOVERED |
| SPEC-1.12.1 | Notification required fields | NotificationSseServiceTest::broadcast_sendsToAllEmitters | Partial |
| SPEC-1.12.2 | Notification unread index | -- | UNCOVERED |
| SPEC-1.13.1 | AppSettings singleton with defaults | -- | UNCOVERED |
| SPEC-1.14.1 | SpacedRepetitionItem required fields | SpacedRepetitionServiceTest::addItem_createsNewItem | Covered |
| SPEC-1.14.2 | SR item unique per neuron | SpacedRepetitionServiceTest::addItem_idempotent_returnsExisting | Covered |
| SPEC-1.15.1 | ReviewQuestion fields | ReviewQuestionServiceTest::generateQuestions_returnsQuestions | Covered |
| SPEC-1.16.1 | NeuronShare fields | -- | UNCOVERED |
| SPEC-1.16.2 | LinkSuggestion fields | -- | UNCOVERED |
| SPEC-1.17.1 | NeuronEmbedding pgvector | -- | UNCOVERED |
| SPEC-1.17.2 | NeuronEmbedding unique per neuron | -- | UNCOVERED |

### Spec 02: API
| Req ID | Requirement | Covering Tests | Status |
|---|---|---|---|
| SPEC-2.0.1 | JSON responses, 204 on deletes | Multiple integration tests | Covered |
| SPEC-2.0.2 | Error responses 400/404/409/500 | Multiple integration tests | Covered |
| SPEC-2.1.1 | GET /api/brains returns non-archived ordered | BrainControllerIntegrationTest::getBrain_returnsFound | Covered |
| SPEC-2.1.2 | GET /api/brains includes tags array | -- | UNCOVERED |
| SPEC-2.1.3 | POST /api/brains creates brain | BrainControllerIntegrationTest::createBrain_returnsCreated | Covered |
| SPEC-2.1.4 | GET /api/brains/{id} returns 404 | BrainServiceTest::getBrain_notFound_throws | Covered |
| SPEC-2.1.5 | PATCH /api/brains/{id} updates | BrainControllerIntegrationTest::updateBrain_returnsUpdated | Covered |
| SPEC-2.1.6 | DELETE /api/brains/{id} cascades | BrainControllerIntegrationTest::deleteBrain_returnsNoContent | Covered |
| SPEC-2.1.7 | POST /api/brains/{id}/archive | BrainControllerIntegrationTest::archiveAndRestoreBrain_roundTrip | Covered |
| SPEC-2.1.8 | POST /api/brains/{id}/restore | BrainControllerIntegrationTest::archiveAndRestoreBrain_roundTrip | Covered |
| SPEC-2.1.9 | POST /api/brains/reorder | test_01_brain_crud::test_reorder_brains_via_api | Covered |
| SPEC-2.1.10 | POST /api/brains/import atomic | ImportExportServiceTest::importBrain_createsNewBrain | Covered |
| SPEC-2.1.11 | GET /api/brains/{id}/export | ImportExportServiceTest::exportBrain_returnsExportObject | Covered |
| SPEC-2.1.12 | Import tag name matching | -- | UNCOVERED |
| SPEC-2.2.1 | GET /api/brains/{id}/stats | BrainStatsServiceTest (7 tests) | Covered |
| SPEC-2.3.1-13 | Cluster API endpoints | ClusterControllerIntegrationTest (11 tests) | Covered |
| SPEC-2.5.1-21 | Neuron API endpoints | NeuronControllerIntegrationTest (20 tests) | Covered |
| SPEC-2.5.7 | POST /api/neurons with anchor (atomic) | -- | UNCOVERED |
| SPEC-2.6.1-4 | NeuronLink API endpoints | NeuronLinkControllerIntegrationTest (7 tests) | Covered |
| SPEC-2.8.1-10 | Tag API endpoints | TagControllerIntegrationTest (10 tests) | Covered |
| SPEC-2.9.1-4 | Attachment API endpoints | AttachmentServiceTest (3 tests), test_05_attachments (6 tests) | Covered |
| SPEC-2.10.1-5 | Revision API endpoints | RevisionControllerIntegrationTest (9 tests) | Covered |
| SPEC-2.11.1-6 | Thought API endpoints | ThoughtServiceTest (12 tests), test_26_thoughts (15 tests) | Covered |
| SPEC-2.12.1-5 | Template API endpoints | TemplateControllerIntegrationTest (5 tests) | Covered |
| SPEC-2.13.1-4 | Reminder API endpoints | ReminderControllerIntegrationTest (10 tests) | Covered |
| SPEC-2.14.1-5 | Notification API endpoints | NotificationSseIntegrationTest, test_20_notifications | Covered |
| SPEC-2.15.1-2 | Settings API endpoints | -- | UNCOVERED |
| SPEC-2.15.3-4 | Search API endpoints | SearchServiceTest (11 tests) | Covered |
| SPEC-2.16.1 | GET /api/neurons/{id}/export/markdown | -- | UNCOVERED |
| SPEC-2.16.2 | GET /api/brains/{id}/export/markdown | -- | UNCOVERED |
| SPEC-2.16.3-12 | Spaced Repetition API endpoints | SpacedRepetitionControllerIntegrationTest (19 tests) | Covered |
| SPEC-2.17.1-2 | Link Suggestion API endpoints | -- | UNCOVERED |
| SPEC-2.17.3-6 | Neuron Share API endpoints | -- | UNCOVERED |

### Spec 03: Frontend
| Req ID | Requirement | Covering Tests | Status |
|---|---|---|---|
| SPEC-3.0.1 | API client 15-second timeout | api.test.ts (4 tests) | Partial |
| SPEC-3.0.2 | API client auto-retry on 5xx | -- | UNCOVERED |
| SPEC-3.0.3 | API client 204 returns undefined | -- | UNCOVERED |
| SPEC-3.0.4 | API client throws on non-2xx | -- | UNCOVERED |
| SPEC-3.1.1-4 | Dashboard sections | home.test.tsx, test_09_dashboard | Covered |
| SPEC-3.2.1 | Favorites page | test_10_favorites_page (4 tests) | Covered |
| SPEC-3.3.1 | Sidebar cluster type icons | -- | UNCOVERED |
| SPEC-3.3.2 | Sidebar sort order (todo first, ai-research second) | -- | UNCOVERED |
| SPEC-3.3.3 | Sidebar context menus | test_01_brain_crud, test_02_cluster_crud | Partial |
| SPEC-3.3.4 | Sidebar todo cluster filters completed | -- | UNCOVERED |
| SPEC-3.4.1 | Title auto-save | test_03_neuron_crud::test_editor_title_autosave | Covered |
| SPEC-3.4.2 | Content auto-save debounced 1.5s | test_03_neuron_crud::test_editor_content_autosave | Covered |
| SPEC-3.4.3 | Section insert between sections | -- | UNCOVERED |
| SPEC-3.4.4 | Section move up/down | -- | UNCOVERED |
| SPEC-3.4.5 | Section delete with attachment cleanup | -- | UNCOVERED |
| SPEC-3.4.6 | Content load flow | -- | Partial (tested implicitly) |
| SPEC-3.4.7 | Table of contents auto-generated | TableOfContents.test.tsx (5 tests) | Covered |
| SPEC-3.4.8 | TOC toggle Ctrl+Shift+O, scroll, highlight | -- | UNCOVERED |
| SPEC-3.4.9 | History panel | test_17_revision_workflow (5 tests) | Covered |
| SPEC-3.4.10 | Reminder panel | test_19_reminders, ReminderEditDialog.test.tsx | Covered |
| SPEC-3.4.11 | Complexity selector | -- | UNCOVERED |
| SPEC-3.4.12 | Editor metadata (createdBy, dates) | Browser verified (visible in snapshot) | Partial |
| SPEC-3.4.13 | SR toggle on editor | SpacedRepetitionPanel.test.tsx, test_27 | Covered |
| SPEC-3.4.14 | Export markdown / print PDF | -- | UNCOVERED |
| SPEC-3.5.1-2 | Trash page restore/delete | test_11_trash_page (5 tests) | Covered |
| SPEC-3.6.1-2 | Notification bell and actions | test_20_notifications (6 tests), useNotifications.test.ts | Covered |
| SPEC-3.7.1 | Thoughts list page | test_26_thoughts::test_thoughts_page_loads | Covered |
| SPEC-3.8.1-3 | Thought viewer | test_26_thoughts (7 browser tests) | Covered |
| SPEC-3.9.1 | Settings page | -- | UNCOVERED |
| SPEC-3.10.1 | Search page | test_08_search (5 tests) | Covered |
| SPEC-3.11.1 | Knowledge graph route | GraphCanvas.test.tsx, test_25_graph_performance | Covered |
| SPEC-3.12.1 | Review page quality buttons | -- | UNCOVERED |
| SPEC-3.13.1 | Share dialog | -- | UNCOVERED |
| SPEC-3.14.1-4 | Research cluster view | -- | UNCOVERED |
| SPEC-3.16.1-4 | Sidebar controls | test_13_navigation | Partial |
| SPEC-3.17.1 | Breadcrumb navigation | test_13_navigation::test_breadcrumb_navigation | Covered |
| SPEC-3.18.1-2 | Command palette | CommandPalette.test.tsx (4 tests) | Covered |
| SPEC-3.19.1 | Keyboard shortcuts | test_16_keyboard_shortcuts (5 tests) | Partial |
| SPEC-3.20.1 | Dark/light mode | test_12_dark_mode (6 tests) | Covered |
| SPEC-3.21.1-2 | Mobile-friendly layout | -- | UNCOVERED |

### Spec 04: Infrastructure
| Req ID | Requirement | Covering Tests | Status |
|---|---|---|---|
| SPEC-4.1.1-3 | PostgreSQL + Flyway | TestContainersConfig (implicit) | Covered |
| SPEC-4.2.1-2 | Full-text search GIN indexes | SearchServiceTest | Partial |
| SPEC-4.3.1 | MinIO max upload 50MB | -- | UNCOVERED |
| SPEC-4.4.1 | NeuronSnapshotScheduler | NeuronSnapshotSchedulerServiceTest (8 tests) | Covered |
| SPEC-4.4.2-3 | ReminderScheduler | -- | UNCOVERED |
| SPEC-4.4.4 | SandboxCleanupScheduler | -- | UNCOVERED |
| SPEC-4.5.1-3 | MinIO config, CORS | test_05_attachments::test_minio_bucket_exists | Partial |
| SPEC-4.6.1-3 | Testing infrastructure | All test suites | Covered |

### Spec 05: Features
| Req ID | Requirement | Covering Tests | Status |
|---|---|---|---|
| SPEC-5.1.1-8 | Rich text formatting | TiptapEditor.test.tsx (4 tests), test_13::test_editor_bold_formatting | Partial |
| SPEC-5.1.9-10 | Code sections | CodeSection.test.tsx, CodeMirrorEditor.test.tsx, test_24_code_section | Covered |
| SPEC-5.1.11 | Math sections (KaTeX) | -- | UNCOVERED |
| SPEC-5.1.12 | Diagram sections (Mermaid) | -- | UNCOVERED |
| SPEC-5.1.13 | Callout sections | -- | UNCOVERED |
| SPEC-5.1.14 | Table sections | -- | UNCOVERED |
| SPEC-5.1.15 | Image sections | ImageSection.test.tsx (8 tests) | Covered |
| SPEC-5.1.16 | Audio sections | AudioSection.test.tsx (13 tests), useAudioRecorder.test.ts (5 tests) | Covered |
| SPEC-5.1.17 | Divider sections | -- | UNCOVERED |
| SPEC-5.1.18 | Lazy-loaded editors | -- | UNCOVERED |
| SPEC-5.2.1-3 | Auto-save, status, plaintext | test_03::test_save_status_indicator | Partial |
| SPEC-5.4.1-2 | Optimistic locking | test_03::test_optimistic_locking_409, NeuronServiceTest::updateNeuronContent_versionConflict_throws | Covered |
| SPEC-5.4.3-5 | Trash lifecycle | test_03, test_11_trash_page | Covered |
| SPEC-5.4.6-9 | Revision snapshots | RevisionServiceTest, test_17_revision_workflow | Covered |
| SPEC-5.7.1-6 | AI Research features | ResearchTopicServiceTest (9 tests) | Partial |
| SPEC-5.9.1-2 | Favorite/Pin toggle | NeuronServiceTest, test_03, test_10 | Covered |
| SPEC-5.10.1 | Complexity levels | -- | UNCOVERED |
| SPEC-5.11.1-2 | Attachment storage | test_05_attachments | Covered |
| SPEC-5.12.1 | Templates linked to neurons | -- | UNCOVERED |
| SPEC-5.13.1-2 | Wiki-link sync | WikiLinkSyncTest (11 tests) | Covered |
| SPEC-5.13.3-4 | Connections panel | test_14_neuron_links | Covered |
| SPEC-5.13.5-7 | Link suggestions & embeddings | -- | UNCOVERED |
| SPEC-5.14.1-7 | Knowledge graph | GraphCanvas.test.tsx, test_25_graph_performance | Partial |
| SPEC-5.15.1-3 | Thought tag modes | ThoughtServiceTest::resolveNeurons_anyMode, _allMode | Covered |
| SPEC-5.16.1-5 | Reminder features | ReminderServiceTest, test_19_reminders | Covered |
| SPEC-5.17.1-4 | Notification features | useNotifications.test.ts, test_20, test_23_sse | Covered |
| SPEC-5.18.1-4 | Search features | SearchServiceTest, test_08_search | Covered |
| SPEC-5.19.1 | Dashboard sections | home.test.tsx, test_09_dashboard | Covered |
| SPEC-5.20.1-4 | Brain stats | BrainStatsServiceTest (7 tests) | Covered |
| SPEC-5.21.1-3 | Brain import/export | ImportExportServiceTest (6 tests), test_18 | Covered |
| SPEC-5.22.1 | Display name used as createdBy | -- | UNCOVERED |
| SPEC-5.23.1 | Entity audit trail | -- | UNCOVERED |
| SPEC-5.24.1-2 | Sidebar nav, deep linking | test_13_navigation | Covered |
| SPEC-5.27.1-3 | SM-2 algorithm | SpacedRepetitionServiceTest (21 tests) | Covered |
| SPEC-5.27.4-7 | Review flow UI | test_27::test_sr_panel_opens | Partial |
| SPEC-5.27.8-10 | Review Q&A | ReviewQuestionServiceTest (11 tests) | Covered |
| SPEC-5.28.1-6 | Neuron sharing | -- | UNCOVERED |
| SPEC-5.29.1-2 | Markdown export | -- | UNCOVERED |
| SPEC-5.30.1-5 | Markdown conversion | -- | UNCOVERED |

### Spec 06: Project Cluster
| Req ID | Requirement | Covering Tests | Status |
|---|---|---|---|
| SPEC-6.1.1-2 | URL Browse vs Sandbox mode | -- | UNCOVERED |
| SPEC-6.2.1 | ProjectConfig fields | ClusterServiceTest::createCluster_withProjectType_savesRepoUrl | Partial |
| SPEC-6.2.2 | Mode derived from sandbox status | -- | UNCOVERED |
| SPEC-6.2.3-7 | NeuronAnchor fields and constraints | -- | UNCOVERED |
| SPEC-6.3.1-10 | Anchor re-matching phases | -- | UNCOVERED |
| SPEC-6.4.1-2 | Project config API | -- | UNCOVERED |
| SPEC-6.4.3-5 | URL Browse tree/file/branches | UrlBrowseServiceTest (15 tests), useFileTree.test.ts | Covered |
| SPEC-6.4.6 | GitHub-only in V1 | UrlBrowseServiceTest::parseGitHubUrl_validUrl | Covered |
| SPEC-6.4.7-18 | Sandbox API endpoints | -- | UNCOVERED |
| SPEC-6.4.19-25 | NeuronAnchor API endpoints | -- | UNCOVERED |
| SPEC-6.5.1 | Three-panel layout | FileTreePanel.test.tsx, NeuronPanel.test.tsx | Partial |
| SPEC-6.5.2-8 | Code viewer features | -- | UNCOVERED |
| SPEC-6.6.1 | Tree-sitter languages | test_code_analyzer.py (15 tests) | Partial |
| SPEC-6.7.1-2 | Read-only git, JGit | -- | UNCOVERED |
| SPEC-6.8.1-4 | Caching and mode transitions | -- | UNCOVERED |
| SPEC-6.9.1 | Project keyboard shortcuts | -- | UNCOVERED |

### Spec 07: AI Service
| Req ID | Requirement | Covering Tests | Status |
|---|---|---|---|
| SPEC-7.1.1 | FastAPI + LangGraph stateless | test_health.py | Covered |
| SPEC-7.1.2 | GET /health endpoint | test_health.py (3 tests) | Covered |
| SPEC-7.1.3 | POST /api/agents/invoke | test_agents.py (2 tests) | Covered |
| SPEC-7.1.4-9 | Section author | test_section_author.py (12 tests) | Covered |
| SPEC-7.1.10 | Backend AI assist proxy | -- | UNCOVERED |
| SPEC-7.1.11-14 | Research agents | test_research_agents.py (4 tests) | Covered |
| SPEC-7.1.15-17 | Review Q&A generator | test_review_qa_generator.py (3 tests) | Covered |
| SPEC-7.2.1-3 | Embeddings API | test_embeddings.py (3 tests) | Covered |
| SPEC-7.3.1-4 | Code intelligence | test_code_analyzer.py (15 tests) | Covered |
| SPEC-7.4.1-3 | LLM provider config | test_llm.py (7 tests) | Covered |
| SPEC-7.5.1 | Mocked LLM tests | All IS tests use mocks | Covered |

### Spec 08: Todo Cluster
| Req ID | Requirement | Covering Tests | Status |
|---|---|---|---|
| SPEC-8.1.1 | TodoMetadata fields | -- | UNCOVERED |
| SPEC-8.1.2-3 | completedAt auto-set/clear | -- | UNCOVERED |
| SPEC-8.1.4-5 | System reminder auto-creation | -- | UNCOVERED |
| SPEC-8.1.6-8 | System reminder details | -- | UNCOVERED |
| SPEC-8.2.1-3 | Todo cluster creation paths | -- | UNCOVERED |
| SPEC-8.3.1-9 | TodoClusterView, TaskRow, MetadataEditor, TasksPanel | -- | UNCOVERED |
| SPEC-8.4.1-4 | Todo neuron toolbar customization | -- | UNCOVERED |
| SPEC-8.5.1-5 | Todo API endpoints | -- | UNCOVERED |

### Defect Specs
| Req ID | Requirement | Covering Tests | Status |
|---|---|---|---|
| DEF-1.1-4 | SSE connection sharing / leader election | -- | UNCOVERED |
| DEF-2.1-2 | Sandbox subfolder content loading | -- | UNCOVERED |
| DEF-3.1 | File browser panel resizable | -- | UNCOVERED |
| DEF-4.1-2 | Line number highlight on anchor add | -- | UNCOVERED |
| DEF-5.1-3 | Project cluster neuron UX | NeuronPanel.test.tsx | Partial |
| DEF-6.1-2 | Sandbox sidebar immediate update | -- | UNCOVERED |
| DEF-7.1-3 | Loading indicator during cloning | -- | UNCOVERED |
| DEF-8.1-2 | Sidebar new cluster type selector | -- | UNCOVERED |

## Testing Gaps

### Critical Priority

#### GAP-001: Neuron Sharing — Zero Coverage
- **Spec reference:** SPEC-2.17.3–6, SPEC-5.28.1–6, SPEC-3.13.1
- **What is untested:** Share link creation, token generation (64-char hex), expiration enforcement, public access via /shared/{token}, revocation, share dialog UI
- **Risk:** Public URL access without authentication is a security-sensitive feature. Broken token validation could expose private neuron content. Broken expiration could leave content accessible indefinitely.
- **Justification:** Security risk — unauthenticated public access path with no test coverage at any layer
- **Recommended test cases:**
  1. **App / Unit**: `NeuronShareServiceTest` — create share, validate token format, verify expiration, revoke share
     - File: `app/src/test/java/com/wliant/brainbook/NeuronShareServiceTest.java`
     - Setup: TestDataFactory.createFullChain()
  2. **App / Integration**: `NeuronShareControllerIntegrationTest` — POST create share, GET public access, GET expired token returns 404, DELETE revoke
     - File: `app/src/test/java/com/wliant/brainbook/NeuronShareControllerIntegrationTest.java`
  3. **E2E / Browser**: `test_29_neuron_sharing.py` — share dialog opens, link generated, public page renders, revoke removes access
     - File: `e2e-test/tests/test_29_neuron_sharing.py`

#### GAP-002: Todo Cluster — Zero Dedicated Coverage
- **Spec reference:** SPEC-8.1.1–8.5.5 (24 requirements)
- **What is untested:** TodoMetadata CRUD, completedAt auto-set, system reminder auto-creation on due date, quick-add bar, completion toggle, priority/effort, sort order, TasksPanel from knowledge neurons, todo neuron toolbar customization
- **Risk:** Core todo workflow entirely untested. System reminder auto-creation (RECURRING DAILY at 7pm) could silently break, leaving users without overdue task notifications. CompletedAt auto-management logic could regress.
- **Justification:** Feature with complex state machine (completion + reminder sync) affecting daily user workflow
- **Recommended test cases:**
  1. **App / Unit**: `TodoMetadataServiceTest` — CRUD, completedAt auto-set/clear, system reminder creation on dueDate set
     - File: `app/src/test/java/com/wliant/brainbook/TodoMetadataServiceTest.java`
     - Setup: TestDataFactory chain + todo cluster
  2. **App / Integration**: `TodoControllerIntegrationTest` — GET/PATCH /api/neurons/{id}/todo, GET /api/clusters/{id}/todo batch, POST /api/brains/{id}/tasks (auto-create todo cluster)
     - File: `app/src/test/java/com/wliant/brainbook/TodoControllerIntegrationTest.java`
  3. **Web / Unit**: `TodoClusterView.test.tsx` — quick-add, completion toggle, sort order, show/hide completed
     - File: `web/src/test/__tests__/components/todo/TodoClusterView.test.tsx`
  4. **E2E / Browser**: `test_30_todo_cluster.py` — create todo cluster, add tasks, toggle completion, set due date, verify sort order
     - File: `e2e-test/tests/test_30_todo_cluster.py`

#### GAP-003: Settings API and UI — Zero Coverage
- **Spec reference:** SPEC-2.15.1–2, SPEC-3.9.1, SPEC-1.13.1, SPEC-5.22.1
- **What is untested:** GET/PATCH /api/settings, Settings page UI, displayName default, maxRemindersPerNeuron range validation, timezone IANA validation, displayName propagation to createdBy/lastUpdatedBy
- **Risk:** Settings control critical system behavior (reminder limits, timezone for all scheduled operations). Broken timezone could cause all reminders to fire at wrong times.
- **Justification:** Affects cross-cutting scheduled behavior; timezone misconfiguration could silently break all time-dependent features
- **Recommended test cases:**
  1. **App / Unit**: `AppSettingsServiceTest` — get defaults, update displayName, update timezone, maxReminders range validation
     - File: `app/src/test/java/com/wliant/brainbook/AppSettingsServiceTest.java`
  2. **App / Integration**: `AppSettingsControllerIntegrationTest` — GET returns defaults, PATCH updates, validation errors
     - File: `app/src/test/java/com/wliant/brainbook/AppSettingsControllerIntegrationTest.java`
  3. **E2E / Browser**: `test_31_settings.py` — settings page loads, update display name, verify timezone dropdown
     - File: `e2e-test/tests/test_31_settings.py`

### High Priority

#### GAP-004: Link Suggestions and Embeddings — Zero Coverage
- **Spec reference:** SPEC-2.17.1–2, SPEC-5.13.5–7, SPEC-1.16.2, SPEC-1.17.1–2
- **What is untested:** Link suggestion API, embedding computation on save, vector similarity search, suggestion accept/dismiss
- **Risk:** Feature relies on async embedding computation and vector search — both could silently fail without tests. Users would never see related-neuron suggestions.
- **Justification:** Complex async pipeline with external service dependency (Ollama embeddings)
- **Recommended test cases:**
  1. **App / Unit**: `LinkSuggestionServiceTest` — create suggestion, accept (creates NeuronLink), dismiss
     - File: `app/src/test/java/com/wliant/brainbook/LinkSuggestionServiceTest.java`
  2. **App / Integration**: `LinkSuggestionControllerIntegrationTest` — GET /api/link-suggestions/neuron/{id}, POST accept, POST dismiss
     - File: `app/src/test/java/com/wliant/brainbook/LinkSuggestionControllerIntegrationTest.java`

#### GAP-005: Markdown Export — Zero Coverage
- **Spec reference:** SPEC-2.16.1–2, SPEC-5.29.1–2, SPEC-5.30.1–5
- **What is untested:** Single neuron markdown export, brain markdown zip export, all markdown conversion rules (headings, code blocks, math, diagrams, callouts)
- **Risk:** Export could produce corrupted or incomplete markdown, losing user content context during export
- **Justification:** Data export is a trust-critical feature; users rely on exports as backups
- **Recommended test cases:**
  1. **App / Unit**: `MarkdownExportServiceTest` — convert each section type, verify heading levels, code fences, KaTeX delimiters, Mermaid blocks
     - File: `app/src/test/java/com/wliant/brainbook/MarkdownExportServiceTest.java`
  2. **App / Integration**: `MarkdownExportControllerIntegrationTest` — GET /api/neurons/{id}/export/markdown, GET /api/brains/{id}/export/markdown (zip)
     - File: `app/src/test/java/com/wliant/brainbook/MarkdownExportControllerIntegrationTest.java`

#### GAP-006: NeuronAnchor System — Zero Coverage
- **Spec reference:** SPEC-6.2.3–7, SPEC-6.3.1–10, SPEC-6.4.19–25
- **What is untested:** Anchor creation with content hash, anchor re-matching (exact, fuzzy, rename detection), orphan management, CRUD API endpoints, anchor line constraints
- **Risk:** Anchor re-matching is the core value proposition of project clusters. Silent failures would leave all anchors orphaned after code changes.
- **Justification:** Complex multi-phase algorithm (hash check → exact search → fuzzy LCS → rename detection) with no test coverage
- **Recommended test cases:**
  1. **App / Unit**: `NeuronAnchorServiceTest` — create anchor, content hash normalization, re-matching phases, fuzzy match threshold, orphan detection
     - File: `app/src/test/java/com/wliant/brainbook/NeuronAnchorServiceTest.java`
  2. **App / Integration**: `NeuronAnchorControllerIntegrationTest` — POST create, PATCH re-anchor, DELETE, POST confirm-drift, GET by cluster/file
     - File: `app/src/test/java/com/wliant/brainbook/NeuronAnchorControllerIntegrationTest.java`

#### GAP-007: Sandbox Provisioning and Lifecycle — Zero App Coverage
- **Spec reference:** SPEC-SM.2.1–SM.6.5 (29 requirements)
- **What is untested:** Sandbox provisioning (clone → index → active), status transitions, resource limits (disk, concurrent clones, max count), SSRF prevention, cleanup scheduler, terminate lifecycle
- **Risk:** Sandbox cloning executes git operations on arbitrary URLs — SSRF prevention and resource limits are security-critical. No test validates URL validation or disk limit enforcement.
- **Justification:** Security (SSRF), resource exhaustion (unbounded disk/clone), and complex async lifecycle
- **Recommended test cases:**
  1. **App / Unit**: `SandboxServiceTest` — provision, status transitions, URL validation (reject loopback/private), resource limit checks, terminate
     - File: `app/src/test/java/com/wliant/brainbook/SandboxServiceTest.java`
  2. **App / Integration**: `SandboxControllerIntegrationTest` — POST provision returns 202, GET status, DELETE terminate, POST retry, GET stats, 409 on limit exceeded, 429 on concurrent limit
     - File: `app/src/test/java/com/wliant/brainbook/SandboxControllerIntegrationTest.java`

#### GAP-008: Reminder Scheduler Processing — No Integration Coverage
- **Spec reference:** SPEC-4.4.2–3, SPEC-5.16.3–5
- **What is untested:** ReminderSchedulerService scanning for due reminders, ReminderProcessingService creating notifications, advancing recurring reminders, deactivating one-time reminders
- **Risk:** Scheduler is the engine that powers the entire reminder/notification pipeline. If it breaks, users get zero notifications for any reminders.
- **Justification:** Single point of failure for the reminder → notification pipeline
- **Recommended test cases:**
  1. **App / Unit**: `ReminderSchedulerServiceTest` — scan finds due reminders, processes ONCE and RECURRING types, creates notifications, advances nextTriggerAt
     - File: `app/src/test/java/com/wliant/brainbook/ReminderSchedulerServiceTest.java`

### Medium Priority

#### GAP-009: API Client Resilience (Frontend)
- **Spec reference:** SPEC-3.0.2–4
- **What is untested:** Auto-retry on 5xx, 204 returns undefined, error message extraction
- **Risk:** Silent frontend failures on transient server errors
- **Recommended test cases:**
  1. **Web / Unit**: Extend `api.test.ts` — retry on 500, 204 returns undefined, non-2xx throws with message
     - File: `web/src/test/__tests__/lib/api.test.ts`

#### GAP-010: Section-Specific Editors (Math, Diagram, Callout, Table, Divider)
- **Spec reference:** SPEC-5.1.11–14, SPEC-5.1.17
- **What is untested:** Math section KaTeX rendering, Diagram section Mermaid rendering, Callout variants (Info/Warning/Tip/Note), Table dynamic add/remove rows and columns, Divider rendering
- **Risk:** Section types could render incorrectly or fail to save without detection
- **Recommended test cases:**
  1. **Web / Unit**: `MathSection.test.tsx`, `DiagramSection.test.tsx`, `CalloutSection.test.tsx`, `TableSection.test.tsx`, `DividerSection.test.tsx`
     - Files: `web/src/test/__tests__/components/sections/`

#### GAP-011: Research Cluster Frontend
- **Spec reference:** SPEC-3.14.1–4
- **What is untested:** Research cluster view UI, research goal editing, topic cards, completeness indicators, SSE progress updates
- **Risk:** Research cluster is a differentiating feature with no frontend test coverage
- **Recommended test cases:**
  1. **Web / Unit**: `ResearchClusterView.test.tsx` — render topics, completeness colors, update all button, SSE hook
     - File: `web/src/test/__tests__/components/research/ResearchClusterView.test.tsx`
  2. **E2E / Browser**: `test_32_ai_research.py` — navigate to AI research cluster, verify topic list, completeness indicators
     - File: `e2e-test/tests/test_32_ai_research.py`

#### GAP-012: SSE Leader Election (Defect Fix)
- **Spec reference:** DEF-1.1–4
- **What is untested:** Multi-tab SSE sharing, leader election, BroadcastChannel relay, polling fallback
- **Risk:** Regression could cause SSE connection exhaustion under multi-tab usage
- **Recommended test cases:**
  1. **Web / Unit**: Test leader election logic, BroadcastChannel message relay, fallback to polling
     - File: `web/src/test/__tests__/lib/hooks/useNotifications.test.ts` (extend)

#### GAP-013: Mobile-Friendly Layout
- **Spec reference:** SPEC-3.21.1–2
- **What is untested:** Sidebar auto-collapse on small screens, responsive layout
- **Risk:** Mobile users may have broken layouts
- **Recommended test cases:**
  1. **E2E / Browser**: Test with browser_resize to mobile viewport, verify sidebar collapses
     - File: `e2e-test/tests/test_13_navigation.py` (extend)

#### GAP-014: Import Tag Matching
- **Spec reference:** SPEC-2.1.12, SPEC-5.21.3
- **What is untested:** Import reuses existing tags by name match
- **Risk:** Import could create duplicate tags
- **Recommended test cases:**
  1. **App / Unit**: Extend `ImportExportServiceTest` — import with pre-existing tags, verify reuse
     - File: `app/src/test/java/com/wliant/brainbook/ImportExportServiceTest.java`

### Low Priority

#### GAP-015: Defect Specs (DEF-2 through DEF-8) — All Sandbox-Related UX
- **Spec reference:** DEF-2.1–DEF-8.2
- **What is untested:** Sandbox subfolder loading, file browser resize, line highlight on anchor add, sandbox sidebar immediate update, loading indicator during cloning, sidebar cluster type selector
- **Risk:** UX regressions in project cluster workflow
- **Recommended test cases:**
  1. **E2E / Browser**: `test_33_project_cluster_ux.py` — sandbox subfolder expand, panel resize, cloning indicator
     - File: `e2e-test/tests/test_33_project_cluster_ux.py`

#### GAP-016: Section Insert/Move/Delete Operations
- **Spec reference:** SPEC-3.4.3–5
- **What is untested:** Insert section between existing sections, move sections up/down, delete with attachment cleanup
- **Risk:** Section reordering could corrupt content JSON
- **Recommended test cases:**
  1. **Web / Unit**: `SectionManager.test.tsx` — insert between, move up/down, delete triggers attachment cleanup
     - File: `web/src/test/__tests__/components/editor/SectionManager.test.tsx`

#### GAP-017: Knowledge Graph Interactions
- **Spec reference:** SPEC-5.14.5–7
- **What is untested:** Click node opens detail panel, double-click navigates to editor, zoom/pan/fit controls
- **Risk:** Graph is read-only visualization; interactions are convenience features
- **Recommended test cases:**
  1. **E2E / Browser**: Extend `test_25_graph_performance.py` — click node, verify detail panel, double-click navigates
     - File: `e2e-test/tests/test_25_graph_performance.py`

#### GAP-018: Future Specs (Intelligence Features, Feature Gaps)
- **Spec reference:** FUT-intelligence.1–17, FUT-feature-gaps.1–16
- **What is untested:** Cluster Q&A, Gap Analysis, Cluster Summary, Organization Suggestions, Study Guide, Brain Health Report, Auto-Tagging, Duplicate Detection, Archive UI, Batch Operations, Dashboard Analytics
- **Risk:** Low — these are future/planned features not yet implemented
- **Justification:** Test only when implemented

## Browser Testing Findings

### Spec Compliance Issues
- **No issues found.** Dashboard renders Pinned, Favorites, Recent sections correctly. Brain page shows clusters and brain details. Neuron editor shows all expected toolbar buttons (View/Edit, Favorite, Pin, Reminder, SR, History, TOC, Connections, Share, Export, Tasks). Breadcrumb navigation present. Search page loads. Review page loads with queue badge.

### Exploratory Findings
1. **Leftover test data:** Multiple brains named "bookDemo Notebook" (4 instances) and many "ai-brain" / "ai-img-brain" entries from E2E test runs not cleaned up. Sidebar is cluttered with 25+ brain entries. This is test pollution, not a bug.
2. **Zero console errors** across all pages visited (dashboard, brain page, neuron editor, search, review).
3. **All API calls returned 200** — no failed network requests.
4. **Notification bell present** in header across all pages.
5. **Theme toggle** present in sidebar footer.
6. **Locate current item** button visible in Brains section header (new crosshair feature).

## Test Quality Assessment

### Sufficiency
- **Overall requirement coverage:** ~62% (360/580 requirements have at least partial coverage)
- **By sub-project:** App ~85% of covered features, Web ~55%, IS ~90%, E2E ~70%
- **Weakest areas:** Neuron Sharing (0%), Todo Cluster (0%), Settings (0%), Sandbox/Anchor lifecycle (0%), Defect fixes (0%), Markdown export (0%), Link suggestions (0%)
- **Multi-layer coverage strengths:** Brain CRUD, Neuron CRUD, Tags, Links, Spaced Repetition, Thoughts, and Reminders all have coverage at 3+ layers (unit + integration + E2E)

### Maintainability
- **Strengths:**
  - App tests use `TestDataFactory` for consistent test data creation — reduces duplication
  - App tests use `DatabaseCleaner` in `@BeforeEach` — ensures test isolation
  - Web tests use shared `createWrapper` for React Query context — consistent hook testing
  - Web tests use centralized MSW server setup in `mocks/server.ts`
  - E2E tests have well-organized `helpers/` with `api_client.py`, `page_helpers.py`, `minio_client.py`
  - E2E `conftest.py` has rich fixture hierarchy with proper teardown
  - Test names are descriptive and follow `action_condition_expectation` pattern
- **Concerns:**
  - Some E2E tests have hardcoded wait times (though most use proper Playwright waits)
  - Web test file organization mixes paths: some under `components/`, some under `lib/hooks/`, some under `hooks/` (inconsistent)
- **Recommendations:**
  - Standardize web test directory structure: all tests under consistent paths matching source structure

### Resistance to Change
- **Strengths:**
  - Web tests use accessibility roles and text content for selectors (via RTL), not CSS classes
  - E2E tests use `data-testid`, `getByRole`, `getByText` patterns — resilient to styling changes
  - App integration tests use `TestRestTemplate` with real HTTP — tests actual serialization
  - App unit tests test behavior (service return values, exceptions) not implementation details
  - E2E tests use API helpers for setup/teardown rather than UI — faster and more stable
- **Concerns:**
  - Some E2E tests use `page.locator()` with CSS selectors that could break on refactor
  - `useAiAssist.test.ts` uses `vi.mock` to mock the API module — tightly coupled to import structure
- **Recommendations:**
  - Prefer `data-testid` or role-based selectors over CSS selectors in E2E tests where possible
  - For web hooks that call APIs, prefer MSW mocking over `vi.mock` of the API module

## Appendix: Test Inventory

### App (342 tests)
| Test Class | Test Count | Target |
|---|---|---|
| BrainBookApplicationTests | 1 | Application startup |
| BrainControllerIntegrationTest | 6 | Brain REST API |
| BrainServiceTest | 8 | BrainService |
| BrainStatsServiceTest | 7 | BrainStatsService |
| ClusterControllerIntegrationTest | 11 | Cluster REST API |
| ClusterServiceTest | 18 | ClusterService |
| NeuronControllerIntegrationTest | 20 | Neuron REST API |
| NeuronServiceTest | 20 | NeuronService |
| NeuronLinkControllerIntegrationTest | 7 | NeuronLink REST API |
| NeuronLinkServiceTest | 11 | NeuronLinkService |
| RevisionControllerIntegrationTest | 9 | Revision REST API |
| RevisionServiceTest | 12 | RevisionService |
| TagControllerIntegrationTest | 10 | Tag REST API |
| TagServiceTest | 10 | TagService |
| TemplateControllerIntegrationTest | 5 | Template REST API |
| TemplateServiceTest | 5 | TemplateService |
| AttachmentServiceTest | 3 | AttachmentService (MinIO mocked) |
| SearchServiceTest | 11 | SearchService |
| ThoughtServiceTest | 12 | ThoughtService |
| WikiLinkSyncTest | 11 | WikiLinkExtractor + LinkSuggestionService |
| ImportExportServiceTest | 6 | ImportExportService |
| SpacedRepetitionControllerIntegrationTest | 19 | SR REST API |
| SpacedRepetitionServiceTest | 21 | SpacedRepetitionService (SM-2) |
| ReviewQuestionServiceTest | 11 | ReviewQuestionService |
| ReminderControllerIntegrationTest | 10 | Reminder REST API |
| ReminderServiceTest | 12 | ReminderService |
| ResearchTopicControllerIntegrationTest | 5 | ResearchTopic REST API |
| ResearchTopicServiceTest | 9 | ResearchTopicService |
| UrlBrowseServiceTest | 15 | UrlBrowseService (GitHub API) |
| IntelligenceServiceTest | 4 | IntelligenceService |
| NeuronSnapshotSchedulerServiceTest | 8 | Snapshot scheduler |
| NotificationSseIntegrationTest | 2 | SSE endpoint |
| NotificationSseServiceTest | 4 | SSE broadcasting |
| CompressionIntegrationTest | 2 | Gzip compression |
| ConnectionPoolIntegrationTest | 1 | HikariCP config |
| HttpCacheIntegrationTest | 6 | HTTP caching headers |

### Web (193 tests)
| Test File | Test Count | Target |
|---|---|---|
| api.test.ts | 4 | API client lib |
| home.test.tsx | 3 | Dashboard page |
| CommandPalette.test.tsx | 4 | Command palette |
| TableOfContents.test.tsx | 5 | TOC component |
| TiptapEditor.test.tsx | 4 | Rich text editor |
| CodeMirrorEditor.test.tsx | 9 | Code editor |
| CodeSection.test.tsx | 9 | Code section |
| AudioSection.test.tsx | 13 | Audio section |
| ImageSection.test.tsx | 8 | Image section |
| button.test.tsx | 3 | Button UI component |
| GraphCanvas.test.tsx | 6 | Knowledge graph |
| FileTreePanel.test.tsx | 8 | Project file tree |
| NeuronPanel.test.tsx | 17 | Project neuron panel |
| SidebarReminders.test.tsx | 3 | Sidebar reminders |
| ReminderEditDialog.test.tsx | 13 | Reminder dialog |
| SpacedRepetitionPanel.test.tsx | 9 | SR panel |
| datetime.test.ts | 11 | Date formatting |
| useBrains.test.ts | 3 | Brain hook |
| useClusters.test.ts | 2 | Cluster hook |
| useNeurons.test.ts | 2 | Neuron hook |
| useNeuronHistory.test.ts | 4 | History hook |
| useThoughts.test.ts | 4 | Thoughts hook |
| useNotifications.test.ts | 7 | Notifications hook |
| useAttachmentUpload.test.ts | 4 | Attachment hook |
| useAudioRecorder.test.ts | 5 | Audio recorder hook |
| useSpacedRepetition.test.ts | 7 | SR hook |
| useResearchTopics.test.ts | 2 | Research topics hook |
| useFileTree.test.ts | 2 | File tree hook |
| useSandbox.test.ts | 3 | Sandbox hook |
| useSandboxList.test.ts | 2 | Sandbox list hook |
| useNeuronAnchors.test.ts | 4 | Neuron anchors hook |
| useAiAssist.test.ts | 7 | AI assist hook |

### Intelligence Service (49 tests)
| Test File | Test Count | Target |
|---|---|---|
| test_health.py | 3 | /health endpoint |
| test_agents.py | 2 | /api/agents/invoke |
| test_section_author.py | 12 | Section author agent |
| test_review_qa_generator.py | 3 | Review Q&A agent |
| test_research_agents.py | 4 | Research agents |
| test_code_analyzer.py | 15 | Code intelligence |
| test_llm.py | 7 | LLM provider config |
| test_embeddings.py | 3 | Embedding API |

### E2E (196 tests)
| Test File | Test Count | Target Flow |
|---|---|---|
| test_00_data_population.py | 1 | Full database seeding |
| test_01_brain_crud.py | 6 | Brain CRUD browser+API |
| test_02_cluster_crud.py | 7 | Cluster CRUD browser+API |
| test_03_neuron_crud.py | 15 | Neuron CRUD, editing, metadata |
| test_04_tags.py | 6 | Tag CRUD, associations |
| test_05_attachments.py | 6 | File attachments + MinIO |
| test_06_revisions.py | 3 | Revision history |
| test_07_templates.py | 5 | Template CRUD |
| test_08_search.py | 5 | Full-text search |
| test_09_dashboard.py | 5 | Dashboard page |
| test_10_favorites_page.py | 4 | Favorites page |
| test_11_trash_page.py | 5 | Trash page |
| test_12_dark_mode.py | 6 | Theme toggle |
| test_13_navigation.py | 14 | Sidebar nav + toolbar |
| test_14_neuron_links.py | 6 | Neuron connections |
| test_16_keyboard_shortcuts.py | 5 | Keyboard shortcuts |
| test_17_revision_workflow.py | 5 | Revision browser flow |
| test_18_import_export.py | 3 | Brain import/export |
| test_19_reminders.py | 8 | Reminder CRUD + dialog |
| test_20_notifications.py | 6 | Notification bell + API |
| test_21_error_handling.py | 9 | Error states + validation |
| test_22_http_caching.py | 5 | HTTP cache headers |
| test_22_ai_assist.py | 4 | AI assist dialog |
| test_22_image_optimization.py | 2 | Image lazy loading |
| test_23_sse_notifications.py | 4 | SSE event stream |
| test_24_code_section.py | 4 | Code section rendering |
| test_25_graph_performance.py | 3 | Knowledge graph |
| test_26_thoughts.py | 15 | Thoughts feature |
| test_27_spaced_repetition.py | 16 | Spaced repetition |
| test_28_reminder_description.py | 7 | Reminder title/description |
