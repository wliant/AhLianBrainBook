"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Sandbox, PullResponse } from "@/types";

export function useSandbox(clusterId: string | null) {
  const queryClient = useQueryClient();

  const { data: sandbox, isLoading: loading, error } = useQuery({
    queryKey: ["sandbox", clusterId],
    queryFn: () => api.sandbox.get(clusterId!),
    enabled: !!clusterId,
    retry: false,
  });

  const provision = async (body?: { branch?: string; shallow?: boolean }) => {
    if (!clusterId) return;
    const result = await api.sandbox.provision(clusterId, body);
    queryClient.invalidateQueries({ queryKey: ["sandbox", clusterId] });
    queryClient.invalidateQueries({ queryKey: ["sandboxes"] });
    return result;
  };

  const terminate = async () => {
    if (!clusterId) return;
    await api.sandbox.terminate(clusterId);
    queryClient.invalidateQueries({ queryKey: ["sandbox", clusterId] });
    queryClient.invalidateQueries({ queryKey: ["sandboxes"] });
  };

  const pull = async (): Promise<PullResponse | undefined> => {
    if (!clusterId) return;
    const result = await api.sandbox.pull(clusterId);
    queryClient.invalidateQueries({ queryKey: ["sandbox", clusterId] });
    queryClient.invalidateQueries({ queryKey: ["neuron-anchors", clusterId] });
    return result;
  };

  const checkout = async (branch: string) => {
    if (!clusterId) return;
    const result = await api.sandbox.checkout(clusterId, branch);
    queryClient.invalidateQueries({ queryKey: ["sandbox", clusterId] });
    queryClient.invalidateQueries({ queryKey: ["neuron-anchors", clusterId] });
    queryClient.invalidateQueries({ queryKey: ["file-tree", clusterId] });
    return result;
  };

  const retry = async () => {
    if (!clusterId) return;
    const result = await api.sandbox.retry(clusterId);
    queryClient.invalidateQueries({ queryKey: ["sandbox", clusterId] });
    queryClient.invalidateQueries({ queryKey: ["sandboxes"] });
    return result;
  };

  return { sandbox: sandbox ?? null, loading, error, provision, terminate, pull, checkout, retry };
}
