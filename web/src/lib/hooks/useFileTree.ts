"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FileTreeEntry } from "@/types";

export function useFileTree(clusterId: string | null, ref?: string) {
  const { data: entries = [], isLoading: loading, isError } = useQuery({
    queryKey: ["file-tree", clusterId, ref],
    queryFn: () => api.browse.tree(clusterId!, ref),
    enabled: !!clusterId,
    retry: false,
  });

  return { entries, loading, isError };
}
