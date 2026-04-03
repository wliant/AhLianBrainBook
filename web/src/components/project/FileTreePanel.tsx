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

function buildTree(entries: FileTreeEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();

  // Sort: directories first, then alphabetical
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  for (const entry of sorted) {
    const node: TreeNode = {
      name: entry.name,
      path: entry.path,
      type: entry.type,
      size: entry.size,
      children: [],
    };

    if (entry.type === "directory") {
      dirMap.set(entry.path, node);
    }

    const lastSlash = entry.path.lastIndexOf("/");
    if (lastSlash === -1) {
      root.push(node);
    } else {
      const parentPath = entry.path.substring(0, lastSlash);
      const parent = dirMap.get(parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        root.push(node);
      }
    }
  }

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
