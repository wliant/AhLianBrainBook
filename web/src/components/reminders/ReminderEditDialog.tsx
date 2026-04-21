"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Reminder } from "@/types";
import { Loader2, Bell, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import Link from "next/link";

interface ReminderEditDialogProps {
  reminder: Reminder;
  brainId?: string;
  clusterId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Reminder) => void;
}

export function ReminderEditDialog({
  reminder,
  brainId,
  clusterId,
  open,
  onOpenChange,
  onSaved,
}: ReminderEditDialogProps) {
  const [title, setTitle] = useState(reminder.title ?? "");
  const [descriptionJson, setDescriptionJson] = useState<Record<string, unknown> | null>(() => {
    try {
      return reminder.description ? JSON.parse(reminder.description) : null;
    } catch {
      return null;
    }
  });
  const [descriptionText, setDescriptionText] = useState(reminder.descriptionText ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDescriptionUpdate = useCallback(
    (json: Record<string, unknown>, text: string) => {
      setDescriptionJson(json);
      setDescriptionText(text);
    },
    []
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.reminders.update(reminder.neuronId, reminder.id, {
        reminderType: reminder.reminderType,
        triggerAt: reminder.triggerAt,
        recurrencePattern: reminder.recurrencePattern,
        recurrenceInterval: reminder.recurrenceInterval,
        title: title.trim() || null,
        description: descriptionJson ? JSON.stringify(descriptionJson) : null,
        descriptionText: descriptionText || null,
      });
      onSaved(updated);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save reminder");
    } finally {
      setSaving(false);
    }
  };

  const neuronHref =
    brainId && clusterId
      ? `/brain/${brainId}/cluster/${clusterId}/neuron/${reminder.neuronId}`
      : null;

  const triggerLabel = new Date(reminder.triggerAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-orange-400" />
            Edit Reminder
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Neuron link */}
          {reminder.neuronTitle && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Linked to:</span>
              {neuronHref ? (
                <Link
                  href={neuronHref}
                  className="flex items-center gap-1 text-primary hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  {reminder.neuronTitle}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <span className="text-foreground">{reminder.neuronTitle}</span>
              )}
            </div>
          )}

          {/* Scheduling summary */}
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-0.5">
            <div>
              <span className="font-medium">
                {reminder.reminderType === "ONCE" ? "One-time" : "Recurring"}
              </span>
              {" · "}
              <span className="text-muted-foreground">{triggerLabel}</span>
            </div>
            {reminder.reminderType === "RECURRING" && reminder.recurrencePattern && (
              <div className="text-muted-foreground">
                Repeats every {reminder.recurrenceInterval}{" "}
                {formatPattern(reminder.recurrencePattern, reminder.recurrenceInterval ?? 1)}
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Title</label>
            <input
              type="text"
              placeholder="Optional title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Description</label>
            <div className="min-h-[160px] rounded-md border border-input">
              <TiptapEditor
                content={descriptionJson}
                onUpdate={handleDescriptionUpdate}
                editable
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatPattern(pattern: string, interval: number) {
  const unit = pattern === "DAILY" ? "day" : pattern === "WEEKLY" ? "week" : "month";
  return interval === 1 ? unit : `${unit}s`;
}
