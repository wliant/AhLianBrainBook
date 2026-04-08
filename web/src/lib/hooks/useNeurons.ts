"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Neuron } from "@/types";

export function useNeurons(clusterId: string | null) {
  const queryClient = useQueryClient();

  const { data: neurons = [], isLoading: loading } = useQuery({
    queryKey: ["neurons", clusterId],
    queryFn: () => api.get<Neuron[]>(`/api/neurons/cluster/${clusterId}`),
    enabled: !!clusterId,
  });

  const createNeuron = async (title: string, brainId: string) => {
    if (!clusterId) return;
    const neuron = await api.post<Neuron>("/api/neurons", {
      title,
      brainId,
      clusterId,
    });
    queryClient.invalidateQueries({ queryKey: ["neurons", clusterId] });
    return neuron;
  };

  const deleteNeuron = async (id: string) => {
    await api.delete(`/api/neurons/${id}`);
    queryClient.invalidateQueries({ queryKey: ["neurons", clusterId] });
  };

  const reorderNeurons = async (orderedIds: string[]) => {
    const previous = queryClient.getQueryData<Neuron[]>(["neurons", clusterId]);

    if (previous) {
      const neuronMap = new Map(previous.map((n) => [n.id, n]));
      const reordered = orderedIds
        .map((id) => neuronMap.get(id))
        .filter(Boolean) as Neuron[];
      queryClient.setQueryData(["neurons", clusterId], reordered);
    }

    try {
      await api.neurons.reorder(orderedIds);
    } catch (err) {
      if (previous) {
        queryClient.setQueryData(["neurons", clusterId], previous);
      }
      console.error("Failed to reorder neurons:", err);
    }
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["neurons", clusterId] });
  };

  return { neurons, loading, createNeuron, deleteNeuron, reorderNeurons, refetch };
}
