"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatRelativeFuture, formatRelativeTime } from "@/lib/datetime";
import type { SpacedRepetitionItem } from "@/types";
import { Loader2, AlertCircle, X, GraduationCap, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SpacedRepetitionPanelProps {
  neuronId: string;
  onClose: () => void;
  addToReview: (neuronId: string) => Promise<void>;
  removeFromReview: (neuronId: string) => Promise<void>;
}

export function SpacedRepetitionPanel({
  neuronId,
  onClose,
  addToReview,
  removeFromReview,
}: SpacedRepetitionPanelProps) {
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<SpacedRepetitionItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.spacedRepetition
      .getItem(neuronId)
      .then((data) => {
        if (!cancelled) setItem(data);
      })
      .catch(() => {
        if (!cancelled) setItem(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [neuronId]);

  const handleAdd = async () => {
    setToggling(true);
    setError(null);
    try {
      await addToReview(neuronId);
      const data = await api.spacedRepetition.getItem(neuronId);
      setItem(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add to review");
    } finally {
      setToggling(false);
    }
  };

  const handleRemove = async () => {
    setToggling(true);
    setError(null);
    try {
      await removeFromReview(neuronId);
      setItem(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove from review");
    } finally {
      setToggling(false);
    }
  };

  const isDue = item ? new Date(item.nextReviewAt).getTime() <= Date.now() : false;

  return (
    <div className="w-full lg:w-80 lg:border-l flex flex-col h-full bg-background shrink-0" data-testid="sr-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">Spaced Repetition</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive mt-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : item ? (
          <div className="space-y-4 pt-3">
            <div className="rounded-md border p-3 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Next review</span>
              <p className={isDue
                ? "text-lg font-semibold text-purple-500"
                : "text-lg font-semibold"
              }>
                {formatRelativeFuture(item.nextReviewAt)}
              </p>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Details</span>
              <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                <span className="text-muted-foreground">Ease factor</span>
                <span className="text-right">{item.easeFactor.toFixed(2)}</span>
                <span className="text-muted-foreground">Interval</span>
                <span className="text-right">{item.intervalDays} day{item.intervalDays !== 1 ? "s" : ""}</span>
                <span className="text-muted-foreground">Reviews</span>
                <span className="text-right">{item.repetitions}</span>
                <span className="text-muted-foreground">Last reviewed</span>
                <span className="text-right">{item.lastReviewedAt ? formatRelativeTime(item.lastReviewedAt) : "Never"}</span>
                <span className="text-muted-foreground">Added</span>
                <span className="text-right">{formatRelativeTime(item.createdAt)}</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={handleRemove}
              disabled={toggling}
              data-testid="sr-remove-btn"
            >
              {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Remove from Review
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-xs text-muted-foreground text-center">
              This neuron is not in your review queue.
            </p>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleAdd}
              disabled={toggling}
              data-testid="sr-add-btn"
            >
              {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GraduationCap className="h-3.5 w-3.5" />}
              Add to Review
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
