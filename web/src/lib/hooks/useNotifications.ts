"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { AppNotification } from "@/types";

const DEFAULT_POLL_INTERVAL = 30_000;
const PAGE_SIZE = 20;

export function useNotifications(options?: { pollInterval?: number }) {
  const pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL;
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await api.notifications.getUnreadCount();
      if (mountedRef.current) {
        setUnreadCount(data.count);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        console.error("Failed to fetch unread count:", err);
      }
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.notifications.getAll(0, PAGE_SIZE);
      if (mountedRef.current) {
        setNotifications(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : "Failed to load notifications";
        setError(message);
        console.error("Failed to fetch notifications:", err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Poll for unread count, pause when tab is hidden
  useEffect(() => {
    fetchUnreadCount();

    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(fetchUnreadCount, pollInterval);
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchUnreadCount();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchUnreadCount, pollInterval]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.notifications.markAsRead(id);
      if (mountedRef.current) {
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
      throw err;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.notifications.markAllAsRead();
      if (mountedRef.current) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      throw err;
    }
  }, []);

  return {
    unreadCount,
    notifications,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    refetch: fetchUnreadCount,
  };
}
