# Project Cluster

## Context

A read-only codebase explorer for studying real-world source code as a learning activity. The user provides a git remote URL, and BrainBook clones and serves a navigable code view with IDE-level intelligence (symbol navigation, file structure). No code editing, no neurons — purely a code reading tool in V1.

Only one Project cluster can exist per brain.

## How It Works

### Setup

1. User creates a Project cluster and provides a git remote URL (and optionally branch, credentials for private repos)
2. Server clones the repository into a managed sandbox
3. Cluster page renders the code explorer UI

### Git Operations

The user can perform read-oriented git operations through the UI:

| Operation | Description |
|-----------|-------------|
| Pull | Fetch latest changes from remote |
| Switch branch | Checkout a different branch |
| View log | Commit history with messages, authors, dates |
| View blame | Line-by-line attribution for the current file |
| View diff | Compare branches or commits |

No push, commit, or any write operations to the remote.

### Code Navigation

IDE-level navigation powered by tree-sitter and/or LSP:

| Feature | Description |
|---------|-------------|
| **File tree** | Hierarchical file/folder view with expand/collapse |
| **Quick open** | Fuzzy file search (Ctrl+P / Cmd+P style) |
| **File structure** | Outline view of the current file (classes, functions, variables) |
| **Go to definition** | Click a symbol to jump to its definition |
| **Find references** | Find all usages of a symbol across the codebase |
| **Syntax highlighting** | Language-aware highlighting for all major languages |
| **Search** | Full-text search across the codebase with regex support |

### Language Intelligence

Use **tree-sitter** for parsing (fast, multi-language, no runtime needed) to provide:
- Symbol extraction (functions, classes, methods, variables)
- Scope-aware navigation
- File structure outlines

For V1, tree-sitter is sufficient. LSP integration can be considered in V2 for richer intelligence (type information, refactoring suggestions, diagnostics).

**Supported languages (V1 priority):** Java, Python, TypeScript/JavaScript, Go, Rust, C/C++. Tree-sitter has grammars for 100+ languages — others can be added incrementally.

## UI Concept

### Cluster Page Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Brain > Project: spring-framework          main ▼  [Pull] [Log]│
├────────────────┬─────────────────────────────────────────────────┤
│ FILE TREE      │  FILE VIEWER                                    │
│                │                                                  │
│ ▼ src/         │  spring-core/src/.../BeanFactory.java           │
│   ▼ main/      │  ─────────────────────────────────────────────  │
│     ▼ java/    │  1  package org.springframework.beans;          │
│       ▼ org/   │  2                                              │
│         ...    │  3  public interface BeanFactory {               │
│   ▼ test/      │  4      Object getBean(String name);            │
│     ...        │  5      <T> T getBean(Class<T> type);           │
│ ▼ docs/        │  6      boolean containsBean(String name);      │
│   ...          │  7  }                                           │
│                │                                                  │
├────────────────┤─────────────────────────────────────────────────┤
│ FILE STRUCTURE │  (or split pane for blame/diff views)           │
│                │                                                  │
│ ◆ BeanFactory  │                                                  │
│   ○ getBean()  │                                                  │
│   ○ getBean()  │                                                  │
│   ○ contains() │                                                  │
└────────────────┴─────────────────────────────────────────────────┘
```

### Key UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| File tree panel | Left sidebar | Browse directory structure |
| File viewer | Main area | Syntax-highlighted read-only code |
| File structure panel | Bottom-left or toggle panel | Symbols in current file |
| Quick open dialog | Overlay (keyboard shortcut) | Fuzzy search for files |
| Branch selector | Header | Switch branches |
| Git log panel | Toggle panel | Commit history |
| Blame view | Inline or side panel | Line attribution |
| Search panel | Toggle panel | Full-text codebase search |

## Architecture

### Sandbox Management

```
User creates Project cluster
    ↓
POST /api/clusters (type: "project", repoUrl: "https://...")
    ↓
[Backend] SandboxService:
  - git clone --depth 1 <url> into managed directory
  - Index with tree-sitter for symbol data
  - Store sandbox metadata (path, branch, last pulled)
    ↓
Sandbox ready, cluster page loads code explorer
```

### Server-Side Components

| Component | Purpose |
|-----------|---------|
| **SandboxService** | Manages git clone, pull, branch switch, cleanup |
| **FileService** | Serves file content, directory listings |
| **GitService** | Exposes log, blame, diff, branch list |
| **SymbolService** | Tree-sitter parsing, symbol extraction, definition/reference lookup |

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/clusters/{id}/sandbox/init` | Clone repo and initialize sandbox |
| POST | `/api/clusters/{id}/sandbox/pull` | Pull latest from remote |
| POST | `/api/clusters/{id}/sandbox/checkout` | Switch branch |
| GET | `/api/clusters/{id}/sandbox/branches` | List branches |
| GET | `/api/clusters/{id}/sandbox/tree?path=` | Directory listing at path |
| GET | `/api/clusters/{id}/sandbox/file?path=` | File content |
| GET | `/api/clusters/{id}/sandbox/structure?path=` | Symbols in file (tree-sitter) |
| GET | `/api/clusters/{id}/sandbox/definition?path=&line=&col=` | Go to definition |
| GET | `/api/clusters/{id}/sandbox/references?path=&line=&col=` | Find references |
| GET | `/api/clusters/{id}/sandbox/search?q=&regex=` | Full-text search |
| GET | `/api/clusters/{id}/sandbox/log?limit=` | Git log |
| GET | `/api/clusters/{id}/sandbox/blame?path=` | Git blame |
| GET | `/api/clusters/{id}/sandbox/diff?from=&to=` | Git diff |

### Where Does Code Intelligence Run?

**Option A: Java backend (recommended for V1)**
- Tree-sitter has Java bindings (tree-sitter-java via JNI)
- Git operations via JGit (pure Java, no git CLI dependency)
- Keeps all logic in the existing Spring Boot app
- File serving is straightforward

**Option B: Dedicated service**
- Separate Python or Node service for tree-sitter + git
- More natural tree-sitter integration (native bindings)
- Adds another service to the stack

Recommendation: Start with Option A. Move to Option B only if tree-sitter JNI becomes a bottleneck.

### Storage

- Cloned repos stored in a configured directory (host volume mount in Docker)
- Shallow clone by default (`--depth 1`) to minimize disk usage
- Full clone available as user option for full history (log, blame)
- Cleanup policy: repos not accessed in N days can be pruned

### Security

- Validate and sanitize repo URLs (prevent local file access, SSRF)
- Run git operations in a sandboxed directory with no access to BrainBook data
- Private repo credentials encrypted at rest
- Resource limits: max repo size, clone timeout

## Future (V2+)

| Feature | Description |
|---------|-------------|
| **Neurons in Project cluster** | Add notes/annotations linked to specific files and line ranges |
| **AI code explanation** | Select code → AI explains what it does, what patterns it uses |
| **Cross-cluster linking** | Link knowledge neurons to specific files/functions in the Project cluster |
| **Code editing** | Allow experimentation — edit code in a sandbox branch |
| **AI-guided code tours** | AI generates a reading order through the codebase for learning |
