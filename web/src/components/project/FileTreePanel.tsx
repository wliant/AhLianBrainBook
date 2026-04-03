"use client";

import { useMemo, useState } from "react";
import { Folder, FolderOpen, FileCode, FileText, ChevronRight, ChevronDown } from "lucide-react";
import type { FileTreeEntry } from "@/types";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number | null;
  children: TreeNode[];
}

function ensureDir(dirMap: Map<string, TreeNode>, root: TreeNode[], dirPath: string): TreeNode {
  const existing = dirMap.get(dirPath);
  if (existing) return existing;

  const lastSlash = dirPath.lastIndexOf("/");
  const name = lastSlash >= 0 ? dirPath.substring(lastSlash + 1) : dirPath;
  const node: TreeNode = { name, path: dirPath, type: "directory", size: null, children: [] };
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
}

function TreeNodeItem({ node, depth, selectedPath, onSelectFile }: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(depth === 0);

  if (node.type === "directory") {
    return (
      <div>
        <button
          className={`flex items-center gap-1 w-full text-left px-2 py-1 text-sm hover:bg-accent rounded-sm transition-colors`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
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
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

export function FileTreePanel({ entries, loading, selectedPath, onSelectFile }: FileTreePanelProps) {
  const tree = useMemo(() => buildTree(entries), [entries]);

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading file tree...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No files found.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full py-1" data-testid="file-tree-panel">
      {tree.map((node) => (
        <TreeNodeItem
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  );
}
