"use client";

import Link from "next/link";
import { Circle, CircleCheck, Trash2 } from "lucide-react";
import type { Neuron, TodoMetadata, TodoPriority, TodoEffort } from "@/types";

interface TodoTaskRowProps {
  neuron: Neuron;
  metadata: TodoMetadata | undefined;
  brainId: string;
  clusterId: string;
  onToggleComplete: (neuronId: string, completed: boolean) => void;
  onDelete: (neuronId: string) => void;
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

export function TodoTaskRow({ neuron, metadata, brainId, clusterId, onToggleComplete, onDelete }: TodoTaskRowProps) {
  const completed = metadata?.completed ?? false;

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors group ${completed ? "opacity-50" : ""}`}>
      <button
        className="shrink-0"
        onClick={() => onToggleComplete(neuron.id, !completed)}
        data-testid={`todo-toggle-${neuron.id}`}
      >
        {completed ? (
          <CircleCheck className="h-5 w-5 text-green-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        )}
      </button>

      <Link
        href={`/brain/${brainId}/cluster/${clusterId}/neuron/${neuron.id}`}
        className={`flex-1 min-w-0 text-sm truncate ${completed ? "line-through text-muted-foreground" : "font-medium"}`}
      >
        {neuron.title || "Untitled"}
      </Link>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {metadata?.priority && metadata.priority !== "normal" && (
          <span className={`hidden sm:inline text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_STYLES[metadata.priority]}`}>
            {metadata.priority}
          </span>
        )}
        {metadata?.effort && (
          <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
            {EFFORT_LABELS[metadata.effort]}
          </span>
        )}
        {metadata?.dueDate && (
          <span className={`text-xs whitespace-nowrap ${getDueDateStyle(metadata.dueDate, completed)}`}>
            {formatDueDate(metadata.dueDate)}
          </span>
        )}
        <button
          className="p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-destructive rounded"
          onClick={(e) => { e.stopPropagation(); onDelete(neuron.id); }}
          title="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
