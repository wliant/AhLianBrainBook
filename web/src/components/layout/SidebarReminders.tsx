"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Reminder } from "@/types";
import { Bell, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReminderEditDialog } from "@/components/reminders/ReminderEditDialog";

export function SidebarReminders() {
  const [expanded, setExpanded] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.reminders.listAll().then((list) => {
      if (!cancelled) setReminders(list);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleReminderClick = (r: Reminder) => {
    setSelectedReminder(r);
    setDialogOpen(true);
  };

  const handleSaved = (updated: Reminder) => {
    setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  if (reminders.length === 0) return null;

  return (
    <>
      <div className="px-3 py-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8"
          onClick={() => setExpanded(!expanded)}
        >
          <Bell className="h-4 w-4" />
          <span className="flex-1 text-left">Reminders</span>
          {reminders.length > 0 && (
            <span className="bg-orange-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center shrink-0">
              {reminders.length}
            </span>
          )}
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform text-muted-foreground", expanded && "rotate-90")}
          />
        </Button>

        {expanded && (
          <div className="mt-0.5 space-y-0.5 pl-1">
            {reminders.map((r) => {
              const isOverdue = new Date(r.triggerAt) < new Date();
              const label = r.title ?? r.neuronTitle ?? "Reminder";
              return (
                <button
                  key={r.id}
                  onClick={() => handleReminderClick(r)}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-sidebar-accent text-left"
                >
                  <Bell className={cn("h-3 w-3 shrink-0", isOverdue ? "text-red-500" : "text-orange-400")} />
                  <span className={cn("flex-1 truncate", isOverdue && "text-red-500")}>
                    {label}
                  </span>
                  <span className={cn("text-[10px] shrink-0", isOverdue ? "text-red-400" : "text-muted-foreground")}>
                    {formatRelative(r.triggerAt)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedReminder && (
        <ReminderEditDialog
          reminder={selectedReminder}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

function formatRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;

  const minutes = Math.floor(abs / 60000);
  const hours = Math.floor(abs / 3600000);
  const days = Math.floor(abs / 86400000);

  let str: string;
  if (minutes < 60) str = `${minutes}m`;
  else if (hours < 24) str = `${hours}h`;
  else str = `${days}d`;

  return past ? `-${str}` : str;
}
