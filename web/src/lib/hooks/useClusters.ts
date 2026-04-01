"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Cluster, ClusterType } from "@/types";

export function useClusters(brainId: string | null) {
  const queryClient = useQueryClient();

  const { data: clusters = [], isLoading: loading } = useQuery({
    queryKey: ["clusters", brainId],
    queryFn: () => api.get<Cluster[]>(`/api/clusters/brain/${brainId}`),
    enabled: !!brainId,
  });

  const createCluster = async (name: string, type?: ClusterType) => {
    if (!brainId) return;
    const cluster = await api.post<Cluster>("/api/clusters", { name, brainId, type: type ?? "knowledge" });
    queryClient.invalidateQueries({ queryKey: ["clusters", brainId] });
    return cluster;
  };

  const updateCluster = async (id: string, name: string, researchGoal?: string) => {
    const cluster = await api.patch<Cluster>(`/api/clusters/${id}`, { name, researchGoal });
    queryClient.invalidateQueries({ queryKey: ["clusters", brainId] });
    return cluster;
  };

  const deleteCluster = async (id: string) => {
    await api.delete(`/api/clusters/${id}`);
    queryClient.invalidateQueries({ queryKey: ["clusters", brainId] });
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["clusters", brainId] });
  };

  return { clusters, loading, createCluster, updateCluster, deleteCluster, refetch };
}
