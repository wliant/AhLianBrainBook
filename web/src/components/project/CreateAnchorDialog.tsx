"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Neuron } from "@/types";

interface CreateAnchorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusterId: string;
  brainId: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export function CreateAnchorDialog({
  open,
  onOpenChange,
  clusterId,
  brainId,
  filePath,
  startLine,
  endLine,
}: CreateAnchorDialogProps) {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  // Reset title when dialog opens or selection changes
  useEffect(() => {
    if (open) setTitle("");
  }, [open, startLine, endLine]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || creating) return;

    setCreating(true);
    try {
      // Atomic neuron + anchor creation
      await api.post<Neuron>("/api/neurons", {
        title: title.trim(),
        brainId,
        clusterId,
        anchor: {
          filePath,
          startLine,
          endLine,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["neurons", clusterId] });
      queryClient.invalidateQueries({ queryKey: ["neuron-anchors", clusterId] });

      setTitle("");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create anchored neuron:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Anchored Neuron</DialogTitle>
          <DialogDescription>
            Anchor a new neuron to{" "}
            <span className="font-mono text-xs">{filePath}</span> at lines{" "}
            {startLine}
            {endLine !== startLine ? `–${endLine}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="neuron-title" className="text-sm font-medium">
                Neuron Title
              </label>
              <Input
                id="neuron-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Bean resolution strategy"
                autoFocus
                data-testid="anchor-neuron-title"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
