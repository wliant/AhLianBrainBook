"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { NeuronLink } from "@/types";

export function useNeuronLinks(neuronId: string | null) {
  const queryClient = useQueryClient();

  const { data: links = [], isLoading: loading } = useQuery({
    queryKey: ["neuronLinks", neuronId],
    queryFn: () => api.neuronLinks.getForNeuron<NeuronLink[]>(neuronId!),
    enabled: !!neuronId,
  });

  const createLink = async (
    sourceNeuronId: string,
    targetNeuronId: string,
    label?: string,
    linkType?: string
  ) => {
    const link = await api.neuronLinks.create<NeuronLink>({
      sourceNeuronId,
      targetNeuronId,
      label,
      linkType,
    });
    queryClient.invalidateQueries({ queryKey: ["neuronLinks", neuronId] });
    return link;
  };

  const deleteLink = async (id: string) => {
    await api.neuronLinks.delete(id);
    queryClient.invalidateQueries({ queryKey: ["neuronLinks", neuronId] });
    queryClient.invalidateQueries({ queryKey: ["linkSuggestions", neuronId] });
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["neuronLinks", neuronId] });
  };

  return { links, loading, createLink, deleteLink, refetch };
}
