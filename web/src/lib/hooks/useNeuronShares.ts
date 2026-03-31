"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { NeuronShare } from "@/types";

export function useNeuronShares(neuronId: string | null) {
  const queryClient = useQueryClient();

  const { data: shares = [], isLoading: loading } = useQuery<NeuronShare[]>({
    queryKey: ["neuron-shares", neuronId],
    queryFn: () => api.get<NeuronShare[]>(`/api/neurons/${neuronId}/shares`),
    enabled: !!neuronId,
  });

  const createShare = async (expiresInHours: number | null) => {
    const body = expiresInHours ? { expiresInHours } : {};
    const share = await api.post<NeuronShare>(`/api/neurons/${neuronId}/share`, body);
    queryClient.invalidateQueries({ queryKey: ["neuron-shares", neuronId] });
    return share;
  };

  const revokeShare = async (shareId: string) => {
    await api.delete(`/api/shares/${shareId}`);
    queryClient.invalidateQueries({ queryKey: ["neuron-shares", neuronId] });
  };

  return { shares, loading, createShare, revokeShare };
}
