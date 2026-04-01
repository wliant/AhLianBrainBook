"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ResearchTopic } from "@/types";

export function useResearchTopics(clusterId: string | null) {
  const queryClient = useQueryClient();

  const { data: topics = [], isLoading: loading } = useQuery({
    queryKey: ["research-topics", clusterId],
    queryFn: () => api.researchTopics.list(clusterId!),
    enabled: !!clusterId,
  });

  const createTopic = async (prompt: string) => {
    if (!clusterId) return;
    const topic = await api.researchTopics.create(clusterId, prompt);
    queryClient.invalidateQueries({ queryKey: ["research-topics", clusterId] });
    return topic;
  };

  const deleteTopic = async (id: string) => {
    if (!clusterId) return;
    await api.researchTopics.delete(clusterId, id);
    queryClient.invalidateQueries({ queryKey: ["research-topics", clusterId] });
  };

  const refreshTopic = async (id: string) => {
    if (!clusterId) return;
    const updated = await api.researchTopics.refresh(clusterId, id);
    queryClient.invalidateQueries({ queryKey: ["research-topics", clusterId] });
    return updated;
  };

  const refreshAll = async () => {
    if (!clusterId) return;
    await api.researchTopics.refreshAll(clusterId);
    queryClient.invalidateQueries({ queryKey: ["research-topics", clusterId] });
  };

  const expandBullet = async (topicId: string, bulletId: string) => {
    if (!clusterId) return;
    const updated = await api.researchTopics.expand(clusterId, topicId, bulletId);
    queryClient.invalidateQueries({ queryKey: ["research-topics", clusterId] });
    return updated;
  };

  return { topics, loading, createTopic, deleteTopic, refreshTopic, refreshAll, expandBullet };
}
