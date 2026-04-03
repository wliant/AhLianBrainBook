"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CodeSymbol } from "@/types";

export function useCodeStructure(clusterId: string | null, path: string | null) {
  const { data, isLoading: loading } = useQuery({
    queryKey: ["code-structure", clusterId, path],
    queryFn: () => api.sandbox.structure(clusterId!, path!),
    enabled: !!clusterId && !!path,
  });

  const symbols: CodeSymbol[] = data?.symbols ?? [];

  return { symbols, loading };
}
