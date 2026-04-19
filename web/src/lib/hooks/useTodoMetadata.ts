"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TodoMetadata } from "@/types";

export function useTodoMetadata(neuronId: string | null) {
  const queryClient = useQueryClient();

  const { data: metadata, isLoading: loading } = useQuery({
    queryKey: ["todo-metadata", neuronId],
    queryFn: () => api.todo.getMetadata(neuronId!),
    enabled: !!neuronId,
  });

  const updateMetadata = async (updates: {
    dueDate?: string | null;
    completed?: boolean;
    effort?: string | null;
    priority?: string;
  }) => {
    if (!neuronId) return;
    const result = await api.todo.updateMetadata(neuronId, updates);
    queryClient.setQueryData(["todo-metadata", neuronId], result);
    queryClient.invalidateQueries({ queryKey: ["todo-cluster-metadata"] });
    return result;
  };

  return { metadata: metadata ?? null, loading, updateMetadata };
}

export function useTodoClusterMetadata(clusterId: string | null) {
  const { data, isLoading: loading } = useQuery({
    queryKey: ["todo-cluster-metadata", clusterId],
    queryFn: () => api.todo.getClusterMetadata(clusterId!),
    enabled: !!clusterId,
  });

  return { metadataMap: data ?? {}, loading };
}

export function useAllTasks() {
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: () => api.todo.listAllTasks(),
  });

  return { tasks: data ?? [], loading, refetch };
}
