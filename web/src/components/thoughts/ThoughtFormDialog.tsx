"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TagFilterSelect } from "@/components/tags/TagFilterSelect";
import type { Tag } from "@/types";

export interface ThoughtFormData {
  name: string;
  description: string;
  neuronTagMode: "any" | "all";
  brainTagMode: "any" | "all";
  neuronTags: Tag[];
  brainTags: Tag[];
}

interface ThoughtFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  allTags: Tag[];
  initial?: Partial<ThoughtFormData>;
  onSubmit: (data: ThoughtFormData) => Promise<void>;
}

export function ThoughtFormDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  allTags,
  initial,
  onSubmit,
}: ThoughtFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [neuronTagMode, setNeuronTagMode] = useState<"any" | "all">("any");
  const [brainTagMode, setBrainTagMode] = useState<"any" | "all">("any");
  const [neuronTags, setNeuronTags] = useState<Tag[]>([]);
  const [brainTags, setBrainTags] = useState<Tag[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setNeuronTagMode(initial?.neuronTagMode ?? "any");
      setBrainTagMode(initial?.brainTagMode ?? "any");
      setNeuronTags(initial?.neuronTags ?? []);
      setBrainTags(initial?.brainTags ?? []);
    }
  }, [open, initial]);

  const canSubmit = name.trim().length > 0 && neuronTags.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), neuronTagMode, brainTagMode, neuronTags, brainTags });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="thought-form-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <Input
              data-testid="thought-name-input"
              placeholder="Thought name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
            <textarea
              data-testid="thought-description-input"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="What is this thought about..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-sm font-medium">Neuron Tags</label>
              <select
                data-testid="neuron-tag-mode-select"
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                value={neuronTagMode}
                onChange={(e) => setNeuronTagMode(e.target.value as "any" | "all")}
              >
                <option value="any">Any of</option>
                <option value="all">All of</option>
              </select>
            </div>
            <TagFilterSelect
              label="Select neuron tags..."
              allTags={allTags}
              selectedTags={neuronTags}
              onSelectionChange={setNeuronTags}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-sm font-medium">Brain Tags (optional)</label>
              <select
                data-testid="brain-tag-mode-select"
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                value={brainTagMode}
                onChange={(e) => setBrainTagMode(e.target.value as "any" | "all")}
              >
                <option value="any">Any of</option>
                <option value="all">All of</option>
              </select>
            </div>
            <TagFilterSelect
              label="Select brain tags..."
              allTags={allTags}
              selectedTags={brainTags}
              onSelectionChange={setBrainTags}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            data-testid="thought-form-submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
