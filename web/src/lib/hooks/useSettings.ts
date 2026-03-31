"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AppSettings } from "@/types";
import { useCallback } from "react";

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings = null, isLoading: loading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings.get(),
    staleTime: Infinity,
  });

  const updateDisplayName = useCallback(async (displayName: string) => {
    const updated = await api.settings.update({ displayName });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
    return updated;
  }, [queryClient]);

  return { settings, loading, updateDisplayName };
}
