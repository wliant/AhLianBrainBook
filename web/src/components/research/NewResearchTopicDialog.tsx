"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NewResearchTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (prompt?: string) => Promise<void>;
}

export function NewResearchTopicDialog({
  open,
  onOpenChange,
  onCreate,
}: NewResearchTopicDialogProps) {
  const [prompt, setPrompt] = useState("");

  const handleCreate = useCallback(async () => {
    const p = prompt.trim() || undefined;
    setPrompt("");
    onOpenChange(false);
    await onCreate(p);
  }, [prompt, onCreate, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Research Topic</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="e.g., Sorting algorithms, Graph traversal... (optional)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          data-testid="research-topic-prompt"
        />
        <p className="text-xs text-muted-foreground">
          Optionally describe a topic. AI will generate a learning map using the research goal and brain context.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
