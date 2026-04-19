"use client";

import Link from "next/link";
import { Circle, CircleCheck } from "lucide-react";
import type { TaskOverviewItem, TodoPriority, TodoEffort } from "@/types";

interface TaskOverviewRowProps {
  task: TaskOverviewItem;
  onToggleComplete: (neuronId: string, completed: boolean) => void;
}

const PRIORITY_STYLES: Record<TodoPriority, string> = {
  critical: "bg-red-500/20 text-red-400",
  important: "bg-orange-500/20 text-orange-400",
  normal: "",
};

const EFFORT_LABELS: Record<TodoEffort, string> = {
  "15min": "15m",
  "30min": "30m",
  "1hr": "1h",
  "2hr": "2h",
  "4hr": "4h",
  "8hr": "8h",
};

function getDueDateStyle(dueDate: string | null, completed: boolean): string {
  if (!dueDate || completed) return "text-muted-foreground";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  if (due < today) return "text-red-400 font-medium";
  if (due.getTime() === today.getTime()) return "text-yellow-400 font-medium";
  return "text-muted-foreground";
}

function formatDueDate(dueDate: string): string {
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff <= 7) return `${diff}d`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskOverviewRow({ task, onToggleComplete }: TaskOverviewRowProps) {
  const { completed } = task;
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors group ${completed ? "opacity-50" : ""}`}
      data-testid={`task-overview-row-${task.neuronId}`}
    >
      <button
        className="shrink-0"
        onClick={() => onToggleComplete(task.neuronId, !completed)}
        data-testid={`task-overview-toggle-${task.neuronId}`}
        aria-label={completed ? "Mark incomplete" : "Mark complete"}
      >
        {completed ? (
          <CircleCheck className="h-5 w-5 text-green-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        )}
      </button>

      <Link
        href={`/brain/${task.brainId}/cluster/${task.clusterId}/neuron/${task.neuronId}`}
        className="flex-1 min-w-0"
      >
        <div className={`text-sm truncate ${completed ? "line-through text-muted-foreground" : "font-medium"}`}>
          {task.title || "Untitled"}
        </div>
        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: task.brainColor ?? "var(--muted-foreground)" }}
          />
          <span className="truncate">
            {task.brainName} · {task.clusterName}
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-2 shrink-0">
        {task.priority !== "normal" && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_STYLES[task.priority]}`}>
            {task.priority}
          </span>
        )}
        {task.effort && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
            {EFFORT_LABELS[task.effort]}
          </span>
        )}
        {task.dueDate && (
          <span className={`text-xs ${getDueDateStyle(task.dueDate, completed)}`}>
            {formatDueDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}
