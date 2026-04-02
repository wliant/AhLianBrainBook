"use client";

import { useState } from "react";
import { Plus, Check, X, Tag as TagIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { useTags } from "@/lib/hooks/useTags";
import type { Tag } from "@/types";

interface TagComboboxProps {
  entityType: "neuron" | "brain";
  entityId: string;
  currentTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
}

export function TagCombobox({ entityType, entityId, currentTags, onTagsChange }: TagComboboxProps) {
  const { tags: allTags, createTag, addTagToNeuron, removeTagFromNeuron, addTagToBrain, removeTagFromBrain } = useTags();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [newTagColor, setNewTagColor] = useState<string | null>(null);

  const currentTagIds = new Set(currentTags.map((t) => t.id));
  const filtered = allTags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );
  const exactMatch = allTags.some((t) => t.name.toLowerCase() === search.toLowerCase());

  const addTag = entityType === "neuron" ? addTagToNeuron : addTagToBrain;
  const removeTag = entityType === "neuron" ? removeTagFromNeuron : removeTagFromBrain;

  const handleToggleTag = async (tag: Tag) => {
    if (currentTagIds.has(tag.id)) {
      await removeTag(entityId, tag.id);
      onTagsChange(currentTags.filter((t) => t.id !== tag.id));
    } else {
      await addTag(entityId, tag.id);
      onTagsChange([...currentTags, tag]);
    }
  };

  const handleCreateTag = async () => {
    if (!search.trim()) return;
    const tag = await createTag(search.trim(), newTagColor || undefined);
    await addTag(entityId, tag.id);
    onTagsChange([...currentTags, tag]);
    setSearch("");
    setNewTagColor(null);
  };

  const handleRemoveTag = async (e: React.MouseEvent, tag: Tag) => {
    e.preventDefault();
    e.stopPropagation();
    await removeTag(entityId, tag.id);
    onTagsChange(currentTags.filter((t) => t.id !== tag.id));
  };

  return (
    <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {currentTags.map((tag) => (
        <Badge
          key={tag.id}
          className="gap-1 cursor-pointer"
          style={tag.color ? { backgroundColor: tag.color + "20", color: tag.color } : undefined}
        >
          {tag.name}
          <X
            className="h-3 w-3 hover:opacity-70"
            onClick={(e) => handleRemoveTag(e, tag)}
          />
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
          >
            <TagIcon className="h-3 w-3" />
            Tag
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-2" onClick={(e) => e.stopPropagation()}>
          <Input
            placeholder="Search or create tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm mb-2"
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                onClick={() => handleToggleTag(tag)}
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0 border"
                  style={{ backgroundColor: tag.color || "var(--muted)" }}
                />
                <span className="flex-1 text-left truncate">{tag.name}</span>
                {currentTagIds.has(tag.id) && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
            {search.trim() && !exactMatch && (
              <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                <ColorPicker value={newTagColor} onChange={setNewTagColor} />
                <button
                  className="flex items-center gap-1 text-primary hover:underline"
                  onClick={handleCreateTag}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create &quot;{search.trim()}&quot;
                </button>
              </div>
            )}
            {filtered.length === 0 && !search.trim() && (
              <p className="text-xs text-muted-foreground text-center py-2">No tags yet</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
