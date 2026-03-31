"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Thought } from "@/types";

export function useThoughts() {
  const queryClient = useQueryClient();

  const { data: thoughts = [], isLoading: loading } = useQuery({
    queryKey: ["thoughts"],
    queryFn: () => api.thoughts.list(),
  });

  const createThought = async (body: {
    name: string;
    description?: string;
    neuronTagMode?: string;
    brainTagMode?: string;
    neuronTagIds: string[];
    brainTagIds?: string[];
  }) => {
    const thought = await api.thoughts.create(body);
    queryClient.invalidateQueries({ queryKey: ["thoughts"] });
    return thought;
  };

  const updateThought = async (id: string, body: {
    name: string;
    description?: string;
    neuronTagMode?: string;
    brainTagMode?: string;
    neuronTagIds: string[];
    brainTagIds?: string[];
  }) => {
    const thought = await api.thoughts.update(id, body);
    queryClient.invalidateQueries({ queryKey: ["thoughts"] });
    return thought;
  };

  const deleteThought = async (id: string) => {
    await api.thoughts.delete(id);
    queryClient.invalidateQueries({ queryKey: ["thoughts"] });
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["thoughts"] });
  };

  return { thoughts, loading, createThought, updateThought, deleteThought, refetch };
}
