"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Neuron, NeuronRevision } from "@/types";

export function useNeuronHistory(neuronId: string | null) {
  const queryClient = useQueryClient();

  const { data: revisions = [], isLoading: loading } = useQuery({
    queryKey: ["neuronHistory", neuronId],
    queryFn: () => api.revisions.list(neuronId!),
    enabled: !!neuronId,
  });

  const createSnapshot = async () => {
    if (!neuronId) return;
    const revision = await api.revisions.create(neuronId);
    queryClient.invalidateQueries({ queryKey: ["neuronHistory", neuronId] });
    return revision;
  };

  const restoreRevision = async (revisionId: string): Promise<Neuron> => {
    const neuron = await api.revisions.restore(revisionId);
    return neuron;
  };

  const deleteRevision = async (revisionId: string) => {
    await api.revisions.delete(revisionId);
    queryClient.invalidateQueries({ queryKey: ["neuronHistory", neuronId] });
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["neuronHistory", neuronId] });
  };

  return { revisions, loading, createSnapshot, restoreRevision, deleteRevision, refetch };
}
