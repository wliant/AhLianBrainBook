# DEF-002: Sandbox Subfolder Content Not Loading

## Status
Open

## Severity
Medium

## Summary
When a sandbox is provisioned, clicking on folders in the file tree does not load their contents. Subfolders appear collapsed but cannot be expanded to view files within them.

## Steps to Reproduce
1. Create a project cluster with a repository URL
2. Provision a sandbox
3. Wait for the sandbox to become active
4. Click on a folder in the file tree (e.g., `app/`, `src/`)
5. Observe that subfolder contents do not load

## Expected Behavior
Clicking a folder should expand it and load its child files and directories from the sandbox file system.

## Actual Behavior
Folder click does not load subfolder contents. The tree remains collapsed or shows no children.

## Affected Components
- **Frontend**: `ProjectClusterView.tsx`, sandbox file tree rendering
- **Backend**: `GET /api/clusters/{id}/sandbox/tree?path=` endpoint
