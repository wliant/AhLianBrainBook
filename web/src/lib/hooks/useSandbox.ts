"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Sandbox, PullResponse } from "@/types";

export function useSandbox(clusterId: string | null) {
  const queryClient = useQueryClient();

  const { data: sandbox, isLoading: loading } = useQuery({
    queryKey: ["sandbox", clusterId],
    queryFn: async () => {
      try {
        return await api.sandbox.get(clusterId!);
      } catch (err: unknown) {
        // 404 means no sandbox provisioned — this is normal, not an error
        if (err instanceof Error && err.message.includes("404")) return null;
        throw err;
      }
    },
    enabled: !!clusterId,
    retry: false,
    // Poll during transitional states to auto-refresh
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "cloning" || status === "indexing" || status === "terminating") {
        return 3000;
      }
      return false;
    },
  });

  // Keep sidebar sandbox list in sync during status transitions
  useEffect(() => {
    if (sandbox?.status) {
      queryClient.invalidateQueries({ queryKey: ["sandboxes"] });
    }
  }, [sandbox?.status, queryClient]);

  const invalidateSandboxQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["sandbox", clusterId] });
    queryClient.invalidateQueries({ queryKey: ["sandboxes"] });
    queryClient.invalidateQueries({ queryKey: ["sandbox-tree", clusterId] });
    queryClient.invalidateQueries({ queryKey: ["sandbox-file", clusterId] });
    queryClient.invalidateQueries({ queryKey: ["sandbox-blame", clusterId] });
    queryClient.invalidateQueries({ queryKey: ["sandbox-log", clusterId] });
    queryClient.invalidateQueries({ queryKey: ["code-structure", clusterId] });
    queryClient.invalidateQueries({ queryKey: ["neuron-anchors", clusterId] });
  };

  const provision = async (body?: { branch?: string; shallow?: boolean }) => {
    if (!clusterId) return;
    const result = await api.sandbox.provision(clusterId, body);
    invalidateSandboxQueries();
    return result;
  };

  const terminate = async () => {
    if (!clusterId) return;
    await api.sandbox.terminate(clusterId);
    queryClient.setQueryData(["sandbox", clusterId], null);
    invalidateSandboxQueries();
  };

  const pull = async (): Promise<PullResponse | undefined> => {
    if (!clusterId) return;
    const result = await api.sandbox.pull(clusterId);
    invalidateSandboxQueries();
    return result;
  };

  const checkout = async (branch: string) => {
    if (!clusterId) return;
    const result = await api.sandbox.checkout(clusterId, branch);
    invalidateSandboxQueries();
    return result;
  };

  const retry = async () => {
    if (!clusterId) return;
    const result = await api.sandbox.retry(clusterId);
    invalidateSandboxQueries();
    return result;
  };

  return { sandbox: sandbox ?? null, loading, provision, terminate, pull, checkout, retry };
}
