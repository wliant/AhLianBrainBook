"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCallback, useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const PAGE_SIZE = 20;

export function useNotifications() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  // SSE connection for real-time updates.
  // Delayed start to allow page load (networkidle) to complete first,
  // since an active EventSource connection keeps the network busy.
  useEffect(() => {
    const timer = setTimeout(() => {
      const es = new EventSource(`${API_BASE}/api/notifications/stream`);
      eventSourceRef.current = es;

      es.addEventListener("unread-count", (event) => {
        const data = JSON.parse(event.data);
        queryClient.setQueryData(["notifications", "unreadCount"], { count: data.count });
      });

      es.addEventListener("new-notification", (event) => {
        const data = JSON.parse(event.data);
        queryClient.setQueryData(["notifications", "unreadCount"], { count: data.count });
        queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      });

      es.onerror = () => {
        // EventSource auto-reconnects on error. No special handling needed.
      };
    }, 2000);

    return () => {
      clearTimeout(timer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
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
