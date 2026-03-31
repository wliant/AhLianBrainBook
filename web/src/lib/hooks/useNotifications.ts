"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AppNotification } from "@/types";
import { useCallback } from "react";

const DEFAULT_POLL_INTERVAL = 30_000;
const PAGE_SIZE = 20;

export function useNotifications(options?: { pollInterval?: number }) {
  const pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL;
  const queryClient = useQueryClient();

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: () => api.notifications.getUnreadCount(),
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false,
  });
  const unreadCount = unreadData?.count ?? 0;

  const { data: notifications = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => api.notifications.getAll(0, PAGE_SIZE),
    enabled: false, // Only fetch when explicitly requested
  });
  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to load notifications") : null;

  const fetchNotifications = useCallback(async () => {
    await queryClient.fetchQuery({
      queryKey: ["notifications", "list"],
      queryFn: () => api.notifications.getAll(0, PAGE_SIZE),
    });
  }, [queryClient]);

  const markAsRead = useCallback(async (id: string) => {
    await api.notifications.markAsRead(id);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  const markAllAsRead = useCallback(async () => {
    await api.notifications.markAllAsRead();
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["notifications", "unreadCount"] });
  }, [queryClient]);

  return {
    unreadCount,
    notifications,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    refetch,
  };
}
