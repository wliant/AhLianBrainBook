"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  utcToLocalDatetimeString,
  localDatetimeToUTCIso,
  getMinDatetimeLocal,
} from "@/lib/datetime";
import type { Reminder } from "@/types";
import { Loader2, Trash2, AlertCircle, X, Bell, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/hooks/useSettings";

interface ReminderPanelProps {
  neuronId: string;
  onClose: () => void;
  onReminderChange: (hasReminder: boolean) => void;
}

export function ReminderPanel({
  neuronId,
  onClose,
  onReminderChange,
}: ReminderPanelProps) {
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { settings } = useSettings();
  const maxReminders = settings?.maxRemindersPerNeuron ?? 10;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.reminders
      .list(neuronId)
      .then((list) => {
        if (cancelled) return;
        setReminders(list);
        onReminderChange(list.length > 0);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load reminders:", { neuronId, error: err });
        setReminders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [neuronId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreated = (saved: Reminder) => {
    setReminders((prev) => [saved, ...prev]);
    setCreating(false);
    onReminderChange(true);
  };

  const handleUpdated = (saved: Reminder) => {
    setReminders((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    setEditingId(null);
  };

  const handleDeleted = (id: string) => {
    const next = reminders.filter((r) => r.id !== id);
    setReminders(next);
    onReminderChange(next.length > 0);
  };

  const atLimit = reminders.length >= maxReminders;

  return (
    <div className="w-full lg:w-80 lg:border-l flex flex-col h-full bg-background shrink-0" data-testid="reminder-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">Reminders ({reminders.length}/{maxReminders})</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {!creating && (
        <div className="px-4 py-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => { setCreating(true); setEditingId(null); }}
            disabled={atLimit}
            data-testid="new-reminder-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            {atLimit ? `Limit reached (${maxReminders})` : "New Reminder"}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {creating && (
              <ReminderForm
                neuronId={neuronId}
                onSave={handleCreated}
                onCancel={() => setCreating(false)}
                onError={setError}
              />
            )}

            {reminders.length === 0 && !creating && (
              <p className="text-xs text-muted-foreground py-4">
                No reminders yet. Create one to get started.
              </p>
            )}

            {reminders.map((r) =>
              editingId === r.id ? (
                <ReminderForm
                  key={r.id}
                  neuronId={neuronId}
                  existing={r}
                  onSave={handleUpdated}
                  onCancel={() => setEditingId(null)}
                  onError={setError}
                />
              ) : (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  neuronId={neuronId}
                  onEdit={() => { setEditingId(r.id); setCreating(false); }}
                  onDelete={handleDeleted}
                  onError={setError}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReminderCard({
  reminder,
  neuronId,
  onEdit,
  onDelete,
  onError,
}: {
  reminder: Reminder;
  neuronId: string;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onError: (msg: string | null) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    onError(null);
    try {
      await api.reminders.delete(neuronId, reminder.id);
      onDelete(reminder.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to delete reminder");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2" data-testid={`reminder-${reminder.id}`}>
      <div className="flex items-center gap-2">
        <Bell className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-xs font-medium">
          {reminder.reminderType === "ONCE" ? "One-time" : "Recurring"}
        </span>
        {reminder.isActive ? (
          <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Active</span>
        ) : (
          <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {reminder.reminderType === "ONCE" ? "Remind at" : "Next reminder"}
        </span>
        <br />
        {formatDateTime(reminder.triggerAt)}
      </div>
      {reminder.reminderType === "RECURRING" && reminder.recurrencePattern && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Repeats</span>
          <br />
          Every {reminder.recurrenceInterval}{" "}
          {formatPattern(reminder.recurrencePattern, reminder.recurrenceInterval!)}
        </div>
      )}
      <div className="flex items-center gap-1 pt-1">
        <button
          onClick={onEdit}
          className="p-1 hover:bg-muted rounded"
          title="Edit"
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1 hover:bg-destructive/10 rounded"
          title="Delete"
        >
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

function ReminderForm({
  neuronId,
  existing,
  onSave,
  onCancel,
  onError,
}: {
  neuronId: string;
  existing?: Reminder;
  onSave: (saved: Reminder) => void;
  onCancel: () => void;
  onError: (msg: string | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [reminderType, setReminderType] = useState<"ONCE" | "RECURRING">(
    existing?.reminderType || "ONCE"
  );
  const [triggerAt, setTriggerAt] = useState(
    existing ? utcToLocalDatetimeString(existing.triggerAt) : ""
  );
  const [recurrencePattern, setRecurrencePattern] = useState<"DAILY" | "WEEKLY" | "MONTHLY">(
    (existing?.recurrencePattern as "DAILY" | "WEEKLY" | "MONTHLY") || "DAILY"
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState(
    existing?.recurrenceInterval || 1
  );

  const handleSave = async () => {
    if (!triggerAt) return;
    setSaving(true);
    onError(null);
    try {
      const body = {
        reminderType,
        triggerAt: localDatetimeToUTCIso(triggerAt),
        recurrencePattern: reminderType === "RECURRING" ? recurrencePattern : null,
        recurrenceInterval: reminderType === "RECURRING" ? recurrenceInterval : null,
      };

      let saved: Reminder;
      if (existing) {
        saved = await api.reminders.update(neuronId, existing.id, body);
      } else {
        saved = await api.reminders.create(neuronId, body);
      }
      onSave(saved);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to save reminder");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/30" data-testid="reminder-form">
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium">Type</legend>
        <div role="radiogroup" aria-label="Reminder type" className="flex gap-2">
          <Button
            type="button"
            role="radio"
            aria-checked={reminderType === "ONCE"}
            variant={reminderType === "ONCE" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setReminderType("ONCE")}
            data-testid="reminder-type-once"
          >
            Once
          </Button>
          <Button
            type="button"
            role="radio"
            aria-checked={reminderType === "RECURRING"}
            variant={reminderType === "RECURRING" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setReminderType("RECURRING")}
            data-testid="reminder-type-recurring"
          >
            Recurring
          </Button>
        </div>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="reminder-trigger-at" className="text-xs font-medium">
          {reminderType === "ONCE" ? "Remind at" : "First reminder at"}
        </label>
        <input
          id="reminder-trigger-at"
          type="datetime-local"
          value={triggerAt}
          min={getMinDatetimeLocal()}
          onChange={(e) => setTriggerAt(e.target.value)}
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {reminderType === "RECURRING" && (
        <div className="space-y-1">
          <label htmlFor="recurrence-interval" className="text-xs font-medium">
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
              className="flex h-8 w-16 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <select
              id="recurrence-pattern"
              aria-label="Recurrence pattern"
              value={recurrencePattern}
              onChange={(e) => setRecurrencePattern(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY")}
              className="flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="DAILY">{recurrenceInterval === 1 ? "day" : "days"}</option>
              <option value="WEEKLY">{recurrenceInterval === 1 ? "week" : "weeks"}</option>
              <option value="MONTHLY">{recurrenceInterval === 1 ? "month" : "months"}</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={handleSave}
          disabled={saving || !triggerAt}
          data-testid="reminder-save-btn"
        >
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          {existing ? "Update" : "Create"}
        </Button>
      </div>
    </div>
  );
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPattern(pattern: string, interval: number) {
  const unit = pattern === "DAILY" ? "day" : pattern === "WEEKLY" ? "week" : "month";
  return interval === 1 ? unit : `${unit}s`;
}
