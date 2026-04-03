"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCallback, useEffect } from "react";
import { participateInSseLeaderElection, type SseEvent } from "@/lib/sseLeaderElection";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const PAGE_SIZE = 20;

export function useNotifications() {
  const queryClient = useQueryClient();

  // SSE connection with cross-tab leader election.
  // Only one tab maintains the actual EventSource connection;
  // other tabs receive events via BroadcastChannel.
  useEffect(() => {
    const handleEvent = (event: SseEvent) => {
      if (event.name === "unread-count") {
        const data = JSON.parse(event.data);
        queryClient.setQueryData(["notifications", "unreadCount"], { count: data.count });
      } else if (event.name === "new-notification") {
        const data = JSON.parse(event.data);
        queryClient.setQueryData(["notifications", "unreadCount"], { count: data.count });
        queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      }
    };

    const cleanup = participateInSseLeaderElection(
      `${API_BASE}/api/notifications/stream`,
      handleEvent
    );

    return cleanup;
  }, [queryClient]);

  // Initial unread count (also updated by SSE)
  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: () => api.notifications.getUnreadCount(),
    staleTime: Infinity, // SSE keeps this fresh, no need to refetch
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
