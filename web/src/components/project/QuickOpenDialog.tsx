"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { getFileIcon } from "@/lib/fileIcons";
import type { FileTreeEntry } from "@/types";

interface QuickOpenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: FileTreeEntry[];
  onSelectFile: (path: string) => void;
}

function fuzzyMatch(query: string, target: string): boolean {
  const lower = target.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function QuickOpenDialog({ open, onOpenChange, entries, onSelectFile }: QuickOpenDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const files = useMemo(
    () => entries.filter((e) => e.type === "file"),
    [entries]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return files.slice(0, 50);
    return files.filter((f) => fuzzyMatch(query, f.path)).slice(0, 50);
  }, [files, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (path: string) => {
      onSelectFile(path);
      onOpenChange(false);
    },
    [onSelectFile, onOpenChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex].path);
        }
      }
    },
    [filtered, selectedIndex, handleSelect]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg" aria-describedby={undefined}>
        <div className="p-3 border-b">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
        <div ref={listRef} className="max-h-[300px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No matching files
            </div>
          ) : (
            filtered.map((entry, i) => {
              const { icon: Icon, className: iconColor } = getFileIcon(entry.name);
              return (
                <button
                  key={entry.path}
                  className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    i === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  }`}
                  onClick={() => handleSelect(entry.path)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
                  <span className="truncate">{entry.path}</span>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
