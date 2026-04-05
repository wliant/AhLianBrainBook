"use client";

import { useMemo, useState, useCallback } from "react";
import { Folder, FolderOpen, FileCode, FileText, ChevronRight, ChevronDown, Loader2, Search, Lock, Box } from "lucide-react";
import type { FileTreeEntry } from "@/types";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number | null;
  children: TreeNode[];
  /** Whether children have been loaded from the server */
  childrenLoaded: boolean;
}

function ensureDir(dirMap: Map<string, TreeNode>, root: TreeNode[], dirPath: string): TreeNode {
  const existing = dirMap.get(dirPath);
  if (existing) return existing;

  const lastSlash = dirPath.lastIndexOf("/");
  const name = lastSlash >= 0 ? dirPath.substring(lastSlash + 1) : dirPath;
  const node: TreeNode = { name, path: dirPath, type: "directory", size: null, children: [], childrenLoaded: false };
  dirMap.set(dirPath, node);

  if (lastSlash === -1) {
    root.push(node);
  } else {
    const parent = ensureDir(dirMap, root, dirPath.substring(0, lastSlash));
    parent.children.push(node);
  }
  return node;
}

function buildTree(entries: FileTreeEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();

  // First pass: register all explicit directories
  for (const entry of entries) {
    if (entry.type === "directory") {
      ensureDir(dirMap, root, entry.path);
    }
  }

  // Second pass: add files, synthesizing missing parent dirs
  const files = entries
    .filter((e) => e.type === "file")
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const entry of files) {
    const node: TreeNode = {
      name: entry.name,
      path: entry.path,
      type: "file",
      size: entry.size,
      children: [],
      childrenLoaded: true,
    };

    const lastSlash = entry.path.lastIndexOf("/");
    if (lastSlash === -1) {
      root.push(node);
    } else {
      const parent = ensureDir(dirMap, root, entry.path.substring(0, lastSlash));
      parent.children.push(node);
    }
  }

  // Sort children: directories first, then alphabetical
  function sortChildren(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children.length > 0) sortChildren(n.children);
    }
  }
  sortChildren(root);

  return root;
}

function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    const found = findNode(node.children, path);
    if (found) return found;
  }
  return null;
}

const CODE_EXTENSIONS = new Set([
  "java", "py", "js", "jsx", "ts", "tsx", "go", "rs", "cpp", "c", "h",
  "cs", "rb", "kt", "swift", "sql", "sh", "bash", "yml", "yaml", "json",
  "xml", "html", "css", "scss", "toml", "gradle",
]);

function isCodeFile(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return CODE_EXTENSIONS.has(name.substring(dot + 1).toLowerCase());
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onLoadChildren?: (path: string) => Promise<FileTreeEntry[]>;
  onChildrenLoaded: (parentPath: string, children: TreeNode[]) => void;
}

function TreeNodeItem({ node, depth, selectedPath, onSelectFile, onLoadChildren, onChildrenLoaded }: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    if (!expanded && !node.childrenLoaded && onLoadChildren) {
      setLoading(true);
      try {
        const entries = await onLoadChildren(node.path);
        // buildTree creates a full tree from paths — extract only the
        // direct children of this node to avoid duplicating the parent.
        const fullTree = buildTree(entries);
        const parentInTree = findNode(fullTree, node.path);
        const children = parentInTree ? parentInTree.children : fullTree;
        onChildrenLoaded(node.path, children);
      } catch (err) {
        console.error("Failed to load directory:", err);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  }, [expanded, node.childrenLoaded, node.path, onLoadChildren, onChildrenLoaded]);

  if (node.type === "directory") {
    return (
      <div>
        <button
          className={`flex items-center gap-1 w-full text-left px-2 py-1 text-sm hover:bg-accent rounded-sm transition-colors`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={handleToggle}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 shrink-0 text-muted-foreground animate-spin" />
          ) : expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          {expanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-yellow-500" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-yellow-500" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && (
          <div>
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                onLoadChildren={onLoadChildren}
                onChildrenLoaded={onChildrenLoaded}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;
  const Icon = isCodeFile(node.name) ? FileCode : FileText;

  return (
    <button
      className={`flex items-center gap-1 w-full text-left px-2 py-1 text-sm rounded-sm transition-colors ${
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
      }`}
      style={{ paddingLeft: `${depth * 16 + 24}px` }}
      onClick={() => onSelectFile(node.path)}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

interface FileTreePanelProps {
  entries: FileTreeEntry[];
  loading: boolean;
  isError?: boolean;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onLoadChildren?: (path: string) => Promise<FileTreeEntry[]>;
  onOpenSearch?: () => void;
  onProvisionSandbox?: () => void;
}

export function FileTreePanel({ entries, loading, isError, selectedPath, onSelectFile, onLoadChildren, onOpenSearch, onProvisionSandbox }: FileTreePanelProps) {
  const initialTree = useMemo(() => buildTree(entries), [entries]);
  const [tree, setTree] = useState<TreeNode[]>(initialTree);

  // Sync tree when entries change (e.g. switching between sandbox/browse mode)
  useMemo(() => {
    setTree(buildTree(entries));
  }, [entries]);

  const handleChildrenLoaded = useCallback((parentPath: string, children: TreeNode[]) => {
    setTree((prev) => {
      function updateNode(nodes: TreeNode[]): TreeNode[] {
        return nodes.map((n) => {
          if (n.path === parentPath) {
            return { ...n, children, childrenLoaded: true };
          }
          if (n.children.length > 0) {
            return { ...n, children: updateNode(n.children) };
          }
          return n;
        });
      }
      return updateNode(prev);
    });
  }, []);

  return (
    <div className="flex flex-col h-full" data-testid="file-tree-panel">
      <div className="flex items-center justify-between px-2 py-1 border-b shrink-0">
        <span className="text-xs font-medium text-muted-foreground">FILES</span>
        <button
          className="p-1 hover:bg-accent rounded-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={onOpenSearch}
          title="Search files (Ctrl+P)"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 py-1">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading file tree...</div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Could not load files</p>
              <p className="text-xs text-muted-foreground mt-1">
                This repository may be private. Provision a sandbox to browse files.
              </p>
            </div>
            {onProvisionSandbox && (
              <button
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                onClick={onProvisionSandbox}
              >
                <Box className="h-3 w-3" />
                Provision Sandbox
              </button>
            )}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No files found.</div>
        ) : (
          tree.map((node) => (
            <TreeNodeItem
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              onLoadChildren={onLoadChildren}
              onChildrenLoaded={handleChildrenLoaded}
            />
          ))
        )}
      </div>
    </div>
  );
}
