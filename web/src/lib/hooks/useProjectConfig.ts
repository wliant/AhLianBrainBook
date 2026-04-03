"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectConfig } from "@/types";

export function useProjectConfig(clusterId: string | null) {
  const queryClient = useQueryClient();

  const { data: config, isLoading: loading } = useQuery({
    queryKey: ["project-config", clusterId],
    queryFn: () => api.projectConfig.get(clusterId!),
    enabled: !!clusterId,
  });

  const updateConfig = async (body: { defaultBranch?: string }) => {
    if (!clusterId) return;
    const updated = await api.projectConfig.update(clusterId, body);
    queryClient.invalidateQueries({ queryKey: ["project-config", clusterId] });
    return updated;
  };

  return { config, loading, updateConfig };
}
