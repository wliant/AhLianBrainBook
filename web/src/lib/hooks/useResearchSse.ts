"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export function useResearchSse(clusterId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!clusterId) return;

    const url = `${API_BASE}/api/clusters/${clusterId}/research-topics/events`;
    const eventSource = new EventSource(url);

    const handleEvent = () => {
      queryClient.invalidateQueries({ queryKey: ["research-topics", clusterId] });
      queryClient.invalidateQueries({ queryKey: ["clusters"] });
    };

    eventSource.addEventListener("cluster-ready", handleEvent);
    eventSource.addEventListener("topic-generated", handleEvent);
    eventSource.addEventListener("topic-updated", handleEvent);
    eventSource.addEventListener("topic-error", handleEvent);

    eventSource.onerror = () => {
      // EventSource auto-reconnects on error
    };

    return () => {
      eventSource.close();
    };
  }, [clusterId, queryClient]);
}
