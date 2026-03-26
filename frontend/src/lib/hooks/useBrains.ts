"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Brain } from "@/types";

export function useBrains() {
  const [brains, setBrains] = useState<Brain[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBrains = useCallback(async () => {
    try {
      const data = await api.get<Brain[]>("/api/brains");
      setBrains(data);
    } catch (err) {
      console.error("Failed to fetch brains:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrains();
  }, [fetchBrains]);

  const createBrain = async (name: string, icon?: string, color?: string) => {
    const brain = await api.post<Brain>("/api/brains", { name, icon, color });
    setBrains((prev) => [...prev, brain]);
    return brain;
  };

  const updateBrain = async (id: string, name: string, icon?: string, color?: string) => {
    const brain = await api.patch<Brain>(`/api/brains/${id}`, { name, icon, color });
    setBrains((prev) => prev.map((b) => (b.id === id ? brain : b)));
    return brain;
  };

  const deleteBrain = async (id: string) => {
    await api.delete(`/api/brains/${id}`);
    setBrains((prev) => prev.filter((b) => b.id !== id));
  };

  return { brains, loading, createBrain, updateBrain, deleteBrain, refetch: fetchBrains };
}
