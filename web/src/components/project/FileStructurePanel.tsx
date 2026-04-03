"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { CodeSymbol } from "@/types";

const KIND_COLORS: Record<string, string> = {
  class: "text-purple-500",
  interface: "text-blue-500",
  method: "text-orange-500",
  function: "text-green-500",
  variable: "text-gray-400",
};

const KIND_ICONS: Record<string, string> = {
  class: "C",
  interface: "I",
  method: "M",
  function: "F",
  variable: "V",
};

interface SymbolNodeProps {
  symbol: CodeSymbol;
  depth: number;
  onSymbolClick: (line: number) => void;
}

function SymbolNode({ symbol, depth, onSymbolClick }: SymbolNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = symbol.children.length > 0;
  const color = KIND_COLORS[symbol.kind] ?? "text-muted-foreground";
  const icon = KIND_ICONS[symbol.kind] ?? "?";

  return (
    <div>
      <button
        className="flex items-center gap-1 w-full text-left px-2 py-0.5 text-sm hover:bg-accent rounded-sm transition-colors"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSymbolClick(symbol.startLine);
        }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className={`w-4 h-4 shrink-0 text-xs font-bold flex items-center justify-center rounded ${color}`}>
          {icon}
        </span>
        <span className="truncate">{symbol.name}</span>
        <span className="ml-auto text-xs text-muted-foreground shrink-0">{symbol.startLine}</span>
      </button>
      {expanded &&
        hasChildren &&
        symbol.children.map((child, i) => (
          <SymbolNode key={`${child.name}-${child.startLine}-${child.endLine}`} symbol={child} depth={depth + 1} onSymbolClick={onSymbolClick} />
        ))}
    </div>
  );
}

interface FileStructurePanelProps {
  symbols: CodeSymbol[];
  loading: boolean;
  onSymbolClick: (line: number) => void;
}

export function FileStructurePanel({ symbols, loading, onSymbolClick }: FileStructurePanelProps) {
  if (loading) {
    return (
      <div className="p-3 text-xs text-muted-foreground">Loading symbols...</div>
    );
  }

  if (symbols.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">No symbols found.</div>
    );
  }

  return (
    <div className="overflow-y-auto py-1" data-testid="file-structure-panel">
      {symbols.map((symbol, i) => (
        <SymbolNode key={`${symbol.name}-${symbol.startLine}-${symbol.endLine}`} symbol={symbol} depth={0} onSymbolClick={onSymbolClick} />
      ))}
    </div>
  );
}
