"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FileContent } from "@/types";

export function useFileContent(clusterId: string | null, path: string | null, ref?: string) {
  const { data: fileContent, isLoading: loading } = useQuery({
    queryKey: ["file-content", clusterId, path, ref],
    queryFn: () => api.browse.file(clusterId!, path!, ref),
    enabled: !!clusterId && !!path,
  });

  return { fileContent, loading };
}
