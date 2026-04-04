"use client";

import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNeurons } from "@/lib/hooks/useNeurons";
import { useTodoClusterMetadata } from "@/lib/hooks/useTodoMetadata";
import { TodoTaskRow } from "./TodoTaskRow";
import { api } from "@/lib/api";
import type { Cluster, TodoMetadata, TodoPriority } from "@/types";

interface TodoClusterViewProps {
  cluster: Cluster;
  brainId: string;
}

const PRIORITY_WEIGHT: Record<TodoPriority, number> = {
  critical: 0,
  important: 1,
  normal: 2,
};

export function TodoClusterView({ cluster, brainId }: TodoClusterViewProps) {
  const { neurons, createNeuron } = useNeurons(cluster.id);
  const { metadataMap } = useTodoClusterMetadata(cluster.id);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const sortedNeurons = useMemo(() => {
    return [...neurons].sort((a, b) => {
      const metaA = metadataMap[a.id];
      const metaB = metadataMap[b.id];
      const compA = metaA?.completed ? 1 : 0;
      const compB = metaB?.completed ? 1 : 0;
      if (compA !== compB) return compA - compB;

      // Due date ascending (nulls last)
      const dueA = metaA?.dueDate ?? "9999-12-31";
      const dueB = metaB?.dueDate ?? "9999-12-31";
      if (dueA !== dueB) return dueA.localeCompare(dueB);

      // Priority (critical first)
      const priA = PRIORITY_WEIGHT[metaA?.priority ?? "normal"];
      const priB = PRIORITY_WEIGHT[metaB?.priority ?? "normal"];
      return priA - priB;
    });
  }, [neurons, metadataMap]);

  const visibleNeurons = useMemo(() => {
    if (showCompleted) return sortedNeurons;
    return sortedNeurons.filter((n) => !metadataMap[n.id]?.completed);
  }, [sortedNeurons, showCompleted, metadataMap]);

  const completedCount = useMemo(
    () => neurons.filter((n) => metadataMap[n.id]?.completed).length,
    [neurons, metadataMap]
  );

  const handleQuickAdd = useCallback(async () => {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const neuron = await createNeuron(title, brainId);
      if (neuron) {
        await api.todo.updateMetadata(neuron.id, { priority: "normal" });
        queryClient.invalidateQueries({ queryKey: ["todo-cluster-metadata", cluster.id] });
      }
      setNewTitle("");
    } finally {
      setCreating(false);
    }
  }, [newTitle, creating, createNeuron, brainId, cluster.id, queryClient]);

  const handleToggleComplete = useCallback(async (neuronId: string, completed: boolean) => {
    await api.todo.updateMetadata(neuronId, { completed });
    queryClient.invalidateQueries({ queryKey: ["todo-cluster-metadata", cluster.id] });
    queryClient.invalidateQueries({ queryKey: ["todo-metadata", neuronId] });
  }, [cluster.id, queryClient]);

  const handleDelete = useCallback(async (neuronId: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      await api.delete(`/api/neurons/${neuronId}`);
      queryClient.invalidateQueries({ queryKey: ["neurons", cluster.id] });
      queryClient.invalidateQueries({ queryKey: ["todo-cluster-metadata", cluster.id] });
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  }, [cluster.id, queryClient]);

  return (
    <div className="flex flex-col h-full" data-testid="todo-cluster-view">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7"
          onClick={() => setShowCompleted((prev) => !prev)}
        >
          {showCompleted ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
          {showCompleted ? "Hide" : "Show"} completed ({completedCount})
        </Button>
      </div>

      {/* Quick add */}
      <div className="px-4 py-2 border-b flex gap-2">
        <Input
          placeholder="Add a task..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
          className="h-8 text-sm"
          data-testid="todo-quick-add"
        />
        <Button size="sm" className="h-8 px-3" onClick={handleQuickAdd} disabled={!newTitle.trim() || creating}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {visibleNeurons.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {neurons.length === 0 ? "No tasks yet. Add one above." : "All tasks completed!"}
          </div>
        ) : (
          visibleNeurons.map((neuron) => (
            <TodoTaskRow
              key={neuron.id}
              neuron={neuron}
              metadata={metadataMap[neuron.id]}
              brainId={brainId}
              clusterId={cluster.id}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
