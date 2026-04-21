"use client";

import { useMemo, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAllTasks } from "@/lib/hooks/useTodoMetadata";
import { api } from "@/lib/api";
import { sortTasksForOverview } from "@/lib/taskSort";
import { TaskOverviewRow } from "@/components/todo/TaskOverviewRow";

export default function TasksPage() {
  const queryClient = useQueryClient();
  const { tasks, loading } = useAllTasks();
  const [showCompleted, setShowCompleted] = useState(false);

  const sorted = useMemo(() => sortTasksForOverview(tasks), [tasks]);
  const visible = useMemo(
    () => (showCompleted ? sorted : sorted.filter((t) => !t.completed)),
    [sorted, showCompleted],
  );
  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);
  const incompleteCount = tasks.length - completedCount;

  const handleToggleComplete = useCallback(
    async (neuronId: string, completed: boolean) => {
      await api.todo.updateMetadata(neuronId, { completed });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["todo-cluster-metadata"] });
      queryClient.invalidateQueries({ queryKey: ["todo-metadata", neuronId] });
    },
    [queryClient],
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto" data-testid="tasks-page">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CheckSquare className="h-6 w-6" />
          Tasks
          {incompleteCount > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({incompleteCount})
            </span>
          )}
        </h1>
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

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Loading tasks...</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm">
            {tasks.length === 0 ? "No tasks yet." : "All tasks completed!"}
          </p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {visible.map((task) => (
            <TaskOverviewRow
              key={task.neuronId}
              task={task}
              onToggleComplete={handleToggleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
