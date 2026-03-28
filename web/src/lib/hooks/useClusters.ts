"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Cluster } from "@/types";

export function useClusters(brainId: string | null) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchClusters = useCallback(async () => {
    if (!brainId) {
      setClusters([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.get<Cluster[]>(`/api/clusters/brain/${brainId}`);
      setClusters(data);
    } catch (err) {
      console.error("Failed to fetch clusters:", err);
    } finally {
      setLoading(false);
    }
  }, [brainId]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  const createCluster = async (name: string) => {
    if (!brainId) return;
    const cluster = await api.post<Cluster>("/api/clusters", { name, brainId });
    setClusters((prev) => [...prev, cluster]);
    return cluster;
  };

  const updateCluster = async (id: string, name: string) => {
    const cluster = await api.patch<Cluster>(`/api/clusters/${id}`, { name });
    setClusters((prev) => prev.map((c) => (c.id === id ? cluster : c)));
    return cluster;
  };

  const deleteCluster = async (id: string) => {
    await api.delete(`/api/clusters/${id}`);
    setClusters((prev) => prev.filter((c) => c.id !== id));
  };

  return { clusters, loading, createCluster, updateCluster, deleteCluster, refetch: fetchClusters };
}
