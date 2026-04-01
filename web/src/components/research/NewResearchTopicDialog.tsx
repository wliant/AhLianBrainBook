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
import { Loader2 } from "lucide-react";

interface NewResearchTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (prompt: string) => Promise<void>;
}

export function NewResearchTopicDialog({
  open,
  onOpenChange,
  onCreate,
}: NewResearchTopicDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!prompt.trim() || creating) return;
    setCreating(true);
    try {
      await onCreate(prompt.trim());
      setPrompt("");
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  }, [prompt, creating, onCreate, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!creating) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Research Topic</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="e.g., Refactoring techniques, Spring Security fundamentals..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          disabled={creating}
          data-testid="research-topic-prompt"
        />
        <p className="text-xs text-muted-foreground">
          AI will generate a structured learning map for this topic based on your existing knowledge.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!prompt.trim() || creating}>
            {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
