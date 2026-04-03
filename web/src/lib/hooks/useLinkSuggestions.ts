"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LinkSuggestion } from "@/types";

export function useLinkSuggestions(neuronId: string | null) {
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading: loading } = useQuery({
    queryKey: ["linkSuggestions", neuronId],
    queryFn: () => api.linkSuggestions.getForNeuron(neuronId!),
    enabled: !!neuronId,
  });

  const acceptSuggestion = async (id: string) => {
    const link = await api.linkSuggestions.accept(id);
    queryClient.invalidateQueries({ queryKey: ["linkSuggestions", neuronId] });
    queryClient.invalidateQueries({ queryKey: ["neuronLinks", neuronId] });
    return link;
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["linkSuggestions", neuronId] });
  };

  return { suggestions, loading, acceptSuggestion, refetch };
}
