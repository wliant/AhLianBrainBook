"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Brain } from "@/types";

export function useBrains() {
  const queryClient = useQueryClient();

  const { data: brains = [], isLoading: loading } = useQuery({
    queryKey: ["brains"],
    queryFn: () => api.get<Brain[]>("/api/brains"),
  });

  const createBrain = async (name: string, icon?: string, color?: string, description?: string) => {
    const brain = await api.post<Brain>("/api/brains", { name, icon, color, description });
    queryClient.invalidateQueries({ queryKey: ["brains"] });
    return brain;
  };

  const updateBrain = async (id: string, name: string, icon?: string, color?: string, description?: string) => {
    const brain = await api.patch<Brain>(`/api/brains/${id}`, { name, icon, color, description });
    queryClient.invalidateQueries({ queryKey: ["brains"] });
    return brain;
  };

  const deleteBrain = async (id: string) => {
    await api.delete(`/api/brains/${id}`);
    queryClient.invalidateQueries({ queryKey: ["brains"] });
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["brains"] });
  };

  return { brains, loading, createBrain, updateBrain, deleteBrain, refetch };
}
