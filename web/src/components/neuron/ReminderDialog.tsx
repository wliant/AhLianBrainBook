"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  utcToLocalDatetimeString,
  localDatetimeToUTCIso,
  getMinDatetimeLocal,
} from "@/lib/datetime";
import type { Reminder } from "@/types";
import { Loader2, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface ReminderDialogProps {
  neuronId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReminderSaved?: (reminder: Reminder) => void;
  onReminderDeleted?: () => void;
}

export function ReminderDialog({
  neuronId,
  open,
  onOpenChange,
  onReminderSaved,
  onReminderDeleted,
}: ReminderDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<Reminder | null>(null);

  const [reminderType, setReminderType] = useState<"ONCE" | "RECURRING">("ONCE");
  const [triggerAt, setTriggerAt] = useState("");
  const [recurrencePattern, setRecurrencePattern] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.reminders
      .get(neuronId)
      .then((r) => {
        if (cancelled) return;
        if (r) {
          setExisting(r);
          setReminderType(r.reminderType);
          setTriggerAt(utcToLocalDatetimeString(r.triggerAt));
          setRecurrencePattern(r.recurrencePattern || "DAILY");
          setRecurrenceInterval(r.recurrenceInterval || 1);
        } else {
          resetForm();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load reminder:", { neuronId, error: err });
        resetForm();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, neuronId]);

  function resetForm() {
    setExisting(null);
    setReminderType("ONCE");
    setTriggerAt("");
    setRecurrencePattern("DAILY");
    setRecurrenceInterval(1);
  }

  async function handleSave() {
    if (!triggerAt) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        reminderType,
        triggerAt: localDatetimeToUTCIso(triggerAt),
        recurrencePattern: reminderType === "RECURRING" ? recurrencePattern : null,
        recurrenceInterval: reminderType === "RECURRING" ? recurrenceInterval : null,
      };

      let saved: Reminder;
      if (existing) {
        saved = await api.reminders.update(neuronId, body);
      } else {
        saved = await api.reminders.create(neuronId, body);
      }
      onReminderSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save reminder";
      setError(message);
      console.error("Failed to save reminder:", { neuronId, reminderType, triggerAt, error: e });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setError(null);
    try {
      await api.reminders.delete(neuronId);
      onReminderDeleted?.();
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete reminder";
      setError(message);
      console.error("Failed to delete reminder:", { neuronId, error: e });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set Reminder</DialogTitle>
          <DialogDescription>
            Configure a reminder for this neuron. You will be notified when the reminder is due.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Reminder Type */}
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Type</legend>
              <div role="radiogroup" aria-label="Reminder type" className="flex gap-2">
                <Button
                  type="button"
                  role="radio"
                  aria-checked={reminderType === "ONCE"}
                  variant={reminderType === "ONCE" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReminderType("ONCE")}
                >
                  Once
                </Button>
                <Button
                  type="button"
                  role="radio"
                  aria-checked={reminderType === "RECURRING"}
                  variant={reminderType === "RECURRING" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReminderType("RECURRING")}
                >
                  Recurring
                </Button>
              </div>
            </fieldset>

            {/* Date/Time */}
            <div className="space-y-1.5">
              <label htmlFor="reminder-trigger-at" className="text-sm font-medium">
                {reminderType === "ONCE" ? "Remind at" : "First reminder at"}
              </label>
              <input
                id="reminder-trigger-at"
                type="datetime-local"
                value={triggerAt}
                min={getMinDatetimeLocal()}
                onChange={(e) => setTriggerAt(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Recurrence settings */}
            {reminderType === "RECURRING" && (
              <div className="space-y-1.5">
                <label htmlFor="recurrence-interval" className="text-sm font-medium">
                  Repeat every
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="recurrence-interval"
                    type="number"
                    min={1}
                    max={365}
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
                    className="flex h-9 w-20 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <select
                    id="recurrence-pattern"
                    aria-label="Recurrence pattern"
                    value={recurrencePattern}
                    onChange={(e) => setRecurrencePattern(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY")}
                    className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="DAILY">{recurrenceInterval === 1 ? "day" : "days"}</option>
                    <option value="WEEKLY">{recurrenceInterval === 1 ? "week" : "weeks"}</option>
                    <option value="MONTHLY">{recurrenceInterval === 1 ? "month" : "months"}</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {existing && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || loading || !triggerAt}
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {existing ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
