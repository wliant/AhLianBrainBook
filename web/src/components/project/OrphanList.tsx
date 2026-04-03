"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle, Trash2, MapPin, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useNeuronAnchors } from "@/lib/hooks/useNeuronAnchors";
import { useNeurons } from "@/lib/hooks/useNeurons";
import type { NeuronAnchor, FileTreeEntry } from "@/types";

type StatusFilter = "all" | "drifted" | "orphaned";

interface OrphanListProps {
  clusterId: string;
  entries: FileTreeEntry[];
  onClose: () => void;
}

interface ReAnchorState {
  anchorId: string;
  filePath: string;
  startLine: string;
  endLine: string;
}

export function OrphanList({ clusterId, entries, onClose }: OrphanListProps) {
  const { anchors, confirmDrift, updateAnchor, deleteAnchor } = useNeuronAnchors(clusterId);
  const { neurons, deleteNeuron } = useNeurons(clusterId);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [reAnchor, setReAnchor] = useState<ReAnchorState | null>(null);

  const neuronTitles = new Map(neurons.map((n) => [n.id, n.title]));

  const problemAnchors = anchors.filter(
    (a) => a.status === "drifted" || a.status === "orphaned"
  );

  const filtered =
    filter === "all"
      ? problemAnchors
      : problemAnchors.filter((a) => a.status === filter);

  const files = entries.filter((e) => e.type === "file");

  const handleConfirm = async (anchor: NeuronAnchor) => {
    try { await confirmDrift(anchor.id); } catch { /* ignore */ }
  };

  const handleDismiss = async (anchor: NeuronAnchor) => {
    try { await deleteAnchor(anchor.id); } catch { /* ignore */ }
  };

  const handleDeleteNeuron = async (anchor: NeuronAnchor) => {
    if (!confirm("Delete this neuron and its anchor?")) return;
    try { await deleteNeuron(anchor.neuronId); } catch { /* ignore */ }
  };

  const handleReAnchorSubmit = async () => {
    if (!reAnchor) return;
    const start = parseInt(reAnchor.startLine);
    const end = parseInt(reAnchor.endLine);
    if (isNaN(start) || isNaN(end) || start < 1 || end < start) return;
    try {
      await updateAnchor(reAnchor.anchorId, {
        filePath: reAnchor.filePath,
        startLine: start,
        endLine: end,
      });
      setReAnchor(null);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-full" data-testid="orphan-list">
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center gap-2">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-medium">Orphaned Anchors ({problemAnchors.length})</h3>
      </div>

      {/* Filter */}
      <div className="flex gap-1 px-3 py-2 border-b">
        {(["all", "drifted", "orphaned"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            className={`text-xs px-2 py-0.5 rounded ${
              filter === f ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground"
            }`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No {filter === "all" ? "orphaned or drifted" : filter} anchors.
          </div>
        ) : (
          filtered.map((anchor) => (
            <div
              key={anchor.id}
              className="p-2 rounded-md border border-border/50 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {neuronTitles.get(anchor.neuronId) || "Untitled"}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                    anchor.status === "drifted"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {anchor.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {anchor.filePath} L{anchor.startLine}–{anchor.endLine}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2"
                  onClick={() =>
                    setReAnchor({
                      anchorId: anchor.id,
                      filePath: anchor.filePath,
                      startLine: String(anchor.startLine),
                      endLine: String(anchor.endLine),
                    })
                  }
                >
                  <MapPin className="h-3 w-3 mr-1" />
                  Re-anchor
                </Button>
                {anchor.status === "drifted" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-2"
                    onClick={() => handleConfirm(anchor)}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Confirm
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2"
                  onClick={() => handleDismiss(anchor)}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2 text-destructive"
                  onClick={() => handleDeleteNeuron(anchor)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Re-anchor Dialog */}
      {reAnchor && (
        <Dialog open={!!reAnchor} onOpenChange={(open) => { if (!open) setReAnchor(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Re-anchor</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">File</label>
                <select
                  className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border bg-background"
                  value={reAnchor.filePath}
                  onChange={(e) => setReAnchor({ ...reAnchor, filePath: e.target.value })}
                >
                  {files.map((f) => (
                    <option key={f.path} value={f.path}>{f.path}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Start line</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border bg-background"
                    value={reAnchor.startLine}
                    onChange={(e) => setReAnchor({ ...reAnchor, startLine: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground">End line</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full mt-1 px-2 py-1.5 text-sm rounded-md border bg-background"
                    value={reAnchor.endLine}
                    onChange={(e) => setReAnchor({ ...reAnchor, endLine: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setReAnchor(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleReAnchorSubmit}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
