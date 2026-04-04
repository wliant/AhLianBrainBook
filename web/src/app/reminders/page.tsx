"use client";

import { useState, useEffect } from "react";
import { Bell, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { Reminder } from "@/types";
import { cn } from "@/lib/utils";
import { ReminderEditDialog } from "@/components/reminders/ReminderEditDialog";

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Reminder | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    api.reminders.listAll().then((list) => {
      setReminders([...list].sort((a, b) => new Date(b.triggerAt).getTime() - new Date(a.triggerAt).getTime()));
    }).catch(() => {
      setError("Failed to load reminders");
    });
  }, []);

  const handleSaved = (updated: Reminder) => {
    setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Bell className="h-6 w-6" />
        Reminders
      </h1>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {reminders.length === 0 && !error ? (
        <p className="text-muted-foreground text-center py-12">No upcoming reminders</p>
      ) : (
        <div className="space-y-1">
          {reminders.map((r) => {
            const isOverdue = new Date(r.triggerAt) < new Date();
            const label = r.title ?? r.neuronTitle ?? "Reminder";
            return (
              <button
                key={r.id}
                onClick={() => { setSelected(r); setDialogOpen(true); }}
                className="w-full flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-accent transition-colors text-left"
              >
                <Bell className={cn("h-4 w-4 shrink-0 mt-0.5", isOverdue ? "text-red-500" : "text-orange-400")} />
                <div className="flex-1 min-w-0">
                  <p className={cn("truncate text-sm font-medium", isOverdue && "text-red-500")}>
                    {label}
                  </p>
                  {r.neuronTitle && r.title && (
                    <p className="truncate text-xs text-muted-foreground">{r.neuronTitle}</p>
                  )}
                  {r.descriptionText && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {r.descriptionText}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("text-xs", isOverdue ? "text-red-400" : "text-muted-foreground")}>
                    {formatDateTime(r.triggerAt)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {r.reminderType === "RECURRING" ? "Recurring" : "Once"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <ReminderEditDialog
          reminder={selected}
          brainId={selected.brainId ?? undefined}
          clusterId={selected.clusterId ?? undefined}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
