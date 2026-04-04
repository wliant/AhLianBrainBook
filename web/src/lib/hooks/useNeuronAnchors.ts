"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { NeuronAnchor } from "@/types";

export function useNeuronAnchors(clusterId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading: loading } = useQuery({
    queryKey: ["neuron-anchors", clusterId],
    queryFn: () => api.neuronAnchors.listByCluster(clusterId!),
    enabled: !!clusterId,
  });

  const anchors = data?.content ?? [];

  const createAnchor = async (body: {
    neuronId: string;
    clusterId: string;
    filePath: string;
  }) => {
    const anchor = await api.neuronAnchors.create(body);
    queryClient.invalidateQueries({ queryKey: ["neuron-anchors", clusterId] });
    return anchor;
  };

  const updateAnchor = async (id: string, body: { filePath: string }) => {
    const anchor = await api.neuronAnchors.update(id, body);
    queryClient.invalidateQueries({ queryKey: ["neuron-anchors", clusterId] });
    return anchor;
  };

  const deleteAnchor = async (id: string) => {
    await api.neuronAnchors.delete(id);
    queryClient.invalidateQueries({ queryKey: ["neuron-anchors", clusterId] });
  };

  return { anchors, loading, createAnchor, updateAnchor, deleteAnchor };
}

export function useFileAnchors(clusterId: string | null, path: string | null) {
  const { data, isLoading: loading } = useQuery({
    queryKey: ["neuron-anchors", clusterId, "file", path],
    queryFn: () => api.neuronAnchors.listByFile(clusterId!, path!),
    enabled: !!clusterId && !!path,
  });

  const anchors = data?.content ?? [];

  return { anchors, loading };
}
