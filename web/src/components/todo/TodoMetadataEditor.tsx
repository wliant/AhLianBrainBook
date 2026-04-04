"use client";

import { Circle, CircleCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { TodoMetadata, TodoPriority, TodoEffort } from "@/types";

interface TodoMetadataEditorProps {
  metadata: TodoMetadata;
  onUpdate: (updates: { dueDate?: string | null; completed?: boolean; effort?: string | null; priority?: string }) => void;
}

const EFFORT_OPTIONS: { value: TodoEffort; label: string }[] = [
  { value: "15min", label: "15 min" },
  { value: "30min", label: "30 min" },
  { value: "1hr", label: "1 hr" },
  { value: "2hr", label: "2 hr" },
  { value: "4hr", label: "4 hr" },
  { value: "8hr", label: "8 hr" },
];

const PRIORITY_OPTIONS: { value: TodoPriority; label: string; color: string }[] = [
  { value: "critical", label: "Critical", color: "text-red-400" },
  { value: "important", label: "Important", color: "text-orange-400" },
  { value: "normal", label: "Normal", color: "text-muted-foreground" },
];

export function TodoMetadataEditor({ metadata, onUpdate }: TodoMetadataEditorProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap px-1 py-2 border-b mb-4" data-testid="todo-metadata-editor">
      {/* Completed toggle */}
      <button
        className="shrink-0"
        onClick={() => onUpdate({ completed: !metadata.completed })}
        title={metadata.completed ? "Mark incomplete" : "Mark complete"}
      >
        {metadata.completed ? (
          <CircleCheck className="h-5 w-5 text-green-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        )}
      </button>

      {/* Due date */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-muted-foreground">Due:</label>
        <Input
          type="date"
          className="h-7 w-auto text-xs px-2"
          value={metadata.dueDate ?? ""}
          onChange={(e) => onUpdate({ dueDate: e.target.value || null })}
        />
      </div>

      {/* Priority */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-muted-foreground">Priority:</label>
        <select
          className="h-7 text-xs rounded-md border border-input bg-background px-2"
          value={metadata.priority}
          onChange={(e) => onUpdate({ priority: e.target.value })}
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Effort */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-muted-foreground">Effort:</label>
        <select
          className="h-7 text-xs rounded-md border border-input bg-background px-2"
          value={metadata.effort ?? ""}
          onChange={(e) => onUpdate({ effort: e.target.value || null })}
        >
          <option value="">—</option>
          {EFFORT_OPTIONS.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
      </div>

      {/* Completed at */}
      {metadata.completed && metadata.completedAt && (
        <span className="text-xs text-muted-foreground">
          Completed {new Date(metadata.completedAt).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}
