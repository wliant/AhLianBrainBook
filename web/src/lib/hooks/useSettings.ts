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
    await api.settings.update({ displayName });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  }, [queryClient]);

  const updateEditorMode = useCallback(async (editorMode: string) => {
    await api.settings.update({ editorMode });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  }, [queryClient]);

  const updateMaxReminders = useCallback(async (maxRemindersPerNeuron: number) => {
    await api.settings.update({ maxRemindersPerNeuron });
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  }, [queryClient]);

  return { settings, loading, updateDisplayName, updateEditorMode, updateMaxReminders };
}
