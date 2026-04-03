"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileCode } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
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
  const contentJsonRef = useRef<Record<string, unknown> | null>(null);
  const contentTextRef = useRef<string>("");
  const queryClient = useQueryClient();

  // Reset when dialog opens or selection changes
  useEffect(() => {
    if (open) {
      setTitle("");
      contentJsonRef.current = null;
      contentTextRef.current = "";
    }
  }, [open, startLine, endLine]);

  const handleEditorUpdate = (json: Record<string, unknown>, text: string) => {
    contentJsonRef.current = json;
    contentTextRef.current = text;
  };

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
        contentJson: contentJsonRef.current ? JSON.stringify(contentJsonRef.current) : undefined,
        contentText: contentTextRef.current || undefined,
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

  const fileName = filePath.split("/").pop() ?? filePath;
  const lineLabel = endLine !== startLine ? `L${startLine}–${endLine}` : `L${startLine}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Anchored Neuron</DialogTitle>
        </DialogHeader>

        {/* File/line callout */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
          <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-mono text-xs truncate">{fileName}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 shrink-0">
            {lineLabel}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="neuron-title" className="text-sm font-medium">
                Title
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

            <div>
              <label className="text-sm font-medium">Notes</label>
              <div className="mt-1 border rounded-md p-2 min-h-[120px] max-h-[300px] overflow-y-auto">
                <TiptapEditor
                  content={null}
                  onUpdate={handleEditorUpdate}
                  editable={true}
                />
              </div>
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
