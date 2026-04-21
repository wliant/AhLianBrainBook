"use client";

import { useState } from "react";
import { Plus, X, Eye, Undo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNeuronHistory } from "@/lib/hooks/useNeuronHistory";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { NeuronRevision } from "@/types";

export function HistoryPanel({
  neuronId,
  onClose,
  onViewRevision,
  onRestore,
}: {
  neuronId: string;
  onClose: () => void;
  onViewRevision: (revision: NeuronRevision) => void;
  onRestore: (revision: NeuronRevision) => Promise<void>;
}) {
  const { revisions, loading, createSnapshot, deleteRevision } =
    useNeuronHistory(neuronId);
  const [confirmRestore, setConfirmRestore] = useState<NeuronRevision | null>(null);
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    if (!confirmRestore) return;
    setRestoring(true);
    try {
      await onRestore(confirmRestore);
    } finally {
      setRestoring(false);
      setConfirmRestore(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full bg-background" data-testid="history-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">History</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => createSnapshot()}
          data-testid="create-snapshot-btn"
        >
          <Plus className="h-3.5 w-3.5" /> Create Snapshot
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {loading && (
          <p className="text-xs text-muted-foreground px-2 py-4">Loading...</p>
        )}

        {!loading && revisions.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-4">
            No history yet. Create a snapshot to save the current state.
          </p>
        )}

        {revisions.map((rev) => (
          <div
            key={rev.id}
            data-testid={`revision-${rev.id}`}
            className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-accent text-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium text-xs">
                #{rev.revisionNumber} {rev.title || "Untitled"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {formatDate(rev.createdAt)}
              </div>
            </div>
            <button
              onClick={() => onViewRevision(rev)}
              className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100"
              title="View"
              data-testid={`view-revision-${rev.id}`}
            >
              <Eye className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              onClick={() => setConfirmRestore(rev)}
              className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100"
              title="Restore"
              data-testid={`restore-revision-${rev.id}`}
            >
              <Undo2 className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              onClick={() => deleteRevision(rev.id)}
              className="p-1 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100"
              title="Delete"
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      <Dialog open={!!confirmRestore} onOpenChange={(open) => !open && setConfirmRestore(null)}>
        <DialogContent data-testid="confirm-restore-dialog">
          <DialogHeader>
            <DialogTitle>Restore Revision</DialogTitle>
            <DialogDescription>
              This will overwrite the current neuron content with revision #{confirmRestore?.revisionNumber}. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(null)}>
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={restoring}>
              {restoring ? "Restoring..." : "Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
