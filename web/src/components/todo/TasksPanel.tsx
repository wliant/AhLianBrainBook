"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { X, Plus, Circle, CircleCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { NeuronLink, TodoMetadata, TodoPriority, TodoEffort } from "@/types";
import { useNeuronLinks } from "@/lib/hooks/useNeuronLinks";

interface TasksPanelProps {
  neuronId: string;
  brainId: string;
  neuronTitle: string;
  onClose: () => void;
}

const PRIORITY_STYLES: Record<TodoPriority, string> = {
  critical: "bg-red-500/20 text-red-400",
  important: "bg-orange-500/20 text-orange-400",
  normal: "",
};

export function TasksPanel({ neuronId, brainId, neuronTitle, onClose }: TasksPanelProps) {
  const queryClient = useQueryClient();
  const { links } = useNeuronLinks(neuronId);
  const [taskMetas, setTaskMetas] = useState<Record<string, TodoMetadata>>({});
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // Filter links to only show outgoing "task" links (this neuron → task neuron)
  const taskLinks = links.filter(
    (l) => l.sourceNeuronId === neuronId && l.linkType === "task"
  );

  // Fetch todo metadata for all linked task neurons
  useEffect(() => {
    const taskNeuronIds = taskLinks.map((l) => l.targetNeuronId);
    if (taskNeuronIds.length === 0) {
      setTaskMetas({});
      return;
    }
    Promise.all(
      taskNeuronIds.map((id) =>
        api.todo.getMetadata(id).catch(() => null)
      )
    ).then((results) => {
      const map: Record<string, TodoMetadata> = {};
      results.forEach((meta) => {
        if (meta) map[meta.neuronId] = meta;
      });
      setTaskMetas(map);
    });
  }, [taskLinks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateTask = useCallback(async () => {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      await api.todo.createTaskFromNeuron(brainId, { sourceNeuronId: neuronId, title });
      queryClient.invalidateQueries({ queryKey: ["neuronLinks", neuronId] });
      setNewTitle("");
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setCreating(false);
    }
  }, [newTitle, creating, brainId, neuronId, queryClient]);

  const handleToggleComplete = useCallback(async (taskNeuronId: string, completed: boolean) => {
    await api.todo.updateMetadata(taskNeuronId, { completed });
    setTaskMetas((prev) => ({
      ...prev,
      [taskNeuronId]: { ...prev[taskNeuronId], completed, completedAt: completed ? new Date().toISOString() : null },
    }));
  }, []);

  const handleUpdateMeta = useCallback(async (taskNeuronId: string, updates: { dueDate?: string | null; priority?: string; effort?: string | null }) => {
    const updated = await api.todo.updateMetadata(taskNeuronId, updates);
    setTaskMetas((prev) => ({ ...prev, [taskNeuronId]: updated }));
  }, []);

  const handleDeleteTask = useCallback(async (taskNeuronId: string) => {
    if (!confirm("Delete this task?")) return;
    await api.delete(`/api/neurons/${taskNeuronId}`);
    queryClient.invalidateQueries({ queryKey: ["neuronLinks", neuronId] });
  }, [neuronId, queryClient]);

  return (
    <div className="fixed inset-x-0 bottom-0 h-[70vh] max-h-[70vh] z-30 border-t bg-background overscroll-contain shadow-[0_-4px_12px_rgba(0,0,0,0.15)] flex flex-col lg:static lg:h-full lg:max-h-none lg:w-80 lg:border-l lg:border-t-0 lg:z-auto lg:shadow-none" data-testid="tasks-panel">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-medium">Tasks</h3>
        <button onClick={onClose} className="p-0.5 hover:bg-accent rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick add */}
      <div className="px-3 py-2 border-b flex gap-2">
        <Input
          placeholder="New task..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
          className="h-7 text-xs"
        />
        <Button size="sm" className="h-7 px-2" onClick={handleCreateTask} disabled={!newTitle.trim() || creating}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {taskLinks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No tasks linked to this neuron.
          </p>
        ) : (
          taskLinks.map((link) => {
            const meta = taskMetas[link.targetNeuronId];
            const completed = meta?.completed ?? false;
            return (
              <div key={link.id} className="rounded-md border border-border/50 p-2 space-y-1.5 group">
                <div className="flex items-center gap-2">
                  <button className="shrink-0" onClick={() => handleToggleComplete(link.targetNeuronId, !completed)}>
                    {completed ? (
                      <CircleCheck className="h-4 w-4 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    )}
                  </button>
                  <Link
                    href={`/brain/${brainId}/cluster/${link.targetNeuronClusterId}/neuron/${link.targetNeuronId}`}
                    className={`text-xs font-medium truncate flex-1 hover:underline ${completed ? "line-through text-muted-foreground" : ""}`}
                  >
                    {link.targetNeuronTitle || "Untitled"}
                  </Link>
                  <button
                    className="p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-destructive rounded"
                    onClick={() => handleDeleteTask(link.targetNeuronId)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {/* Inline metadata editing */}
                {meta && (
                  <div className="flex items-center gap-2 ml-6 flex-wrap">
                    <input
                      type="date"
                      className="h-5 text-[10px] rounded border border-input bg-background px-1 w-28"
                      value={meta.dueDate ?? ""}
                      onChange={(e) => handleUpdateMeta(link.targetNeuronId, { dueDate: e.target.value || null })}
                    />
                    <select
                      className="h-5 text-[10px] rounded border border-input bg-background px-0.5"
                      value={meta.priority}
                      onChange={(e) => handleUpdateMeta(link.targetNeuronId, { priority: e.target.value })}
                    >
                      <option value="critical">Critical</option>
                      <option value="important">Important</option>
                      <option value="normal">Normal</option>
                    </select>
                    <select
                      className="h-5 text-[10px] rounded border border-input bg-background px-0.5"
                      value={meta.effort ?? ""}
                      onChange={(e) => handleUpdateMeta(link.targetNeuronId, { effort: e.target.value || null })}
                    >
                      <option value="">—</option>
                      <option value="15min">15m</option>
                      <option value="30min">30m</option>
                      <option value="1hr">1h</option>
                      <option value="2hr">2h</option>
                      <option value="4hr">4h</option>
                      <option value="8hr">8h</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
