"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Tag } from "@/types";

interface TagFilterSelectProps {
  label: string;
  allTags: Tag[];
  selectedTags: Tag[];
  onSelectionChange: (tags: Tag[]) => void;
}

export function TagFilterSelect({ label, allTags, selectedTags, onSelectionChange }: TagFilterSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selectedIds = new Set(selectedTags.map((t) => t.id));
  const filtered = allTags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (tag: Tag) => {
    if (selectedIds.has(tag.id)) {
      onSelectionChange(selectedTags.filter((t) => t.id !== tag.id));
    } else {
      onSelectionChange([...selectedTags, tag]);
    }
  };

  const handleRemove = (tag: Tag) => {
    onSelectionChange(selectedTags.filter((t) => t.id !== tag.id));
  };

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            {label}
            {selectedTags.length > 0 && (
              <Badge className="ml-1 px-1.5 py-0 text-xs">
                {selectedTags.length}
              </Badge>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-2 w-64" align="start">
          <Input
            placeholder="Search tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm mb-2"
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                onClick={() => handleToggle(tag)}
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0 border"
                  style={{ backgroundColor: tag.color || "var(--muted)" }}
                />
                <span className="flex-1 text-left truncate">{tag.name}</span>
                {selectedIds.has(tag.id) && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No tags found</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              className="gap-1 cursor-pointer"
              style={tag.color ? { backgroundColor: tag.color + "20", color: tag.color } : undefined}
            >
              {tag.name}
              <X className="h-3 w-3 hover:opacity-70" onClick={() => handleRemove(tag)} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
