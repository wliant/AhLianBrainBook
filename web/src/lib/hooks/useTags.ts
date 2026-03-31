"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tag } from "@/types";

export function useTags() {
  const queryClient = useQueryClient();

  const { data: tags = [], isLoading: loading } = useQuery({
    queryKey: ["tags"],
    queryFn: () => api.get<Tag[]>("/api/tags"),
  });

  const createTag = async (name: string, color?: string) => {
    const tag = await api.post<Tag>("/api/tags", { name, color });
    queryClient.invalidateQueries({ queryKey: ["tags"] });
    return tag;
  };

  const addTagToNeuron = async (neuronId: string, tagId: string) => {
    await api.post<void>(`/api/tags/neurons/${neuronId}/tags/${tagId}`);
  };

  const removeTagFromNeuron = async (neuronId: string, tagId: string) => {
    await api.delete<void>(`/api/tags/neurons/${neuronId}/tags/${tagId}`);
  };

  const addTagToBrain = async (brainId: string, tagId: string) => {
    await api.post<void>(`/api/tags/brains/${brainId}/tags/${tagId}`);
  };

  const removeTagFromBrain = async (brainId: string, tagId: string) => {
    await api.delete<void>(`/api/tags/brains/${brainId}/tags/${tagId}`);
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["tags"] });
  };

  return { tags, loading, createTag, addTagToNeuron, removeTagFromNeuron, addTagToBrain, removeTagFromBrain, refetch };
}
