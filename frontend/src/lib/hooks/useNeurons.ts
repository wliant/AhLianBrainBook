"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Neuron } from "@/types";

export function useNeurons(clusterId: string | null) {
  const [neurons, setNeurons] = useState<Neuron[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNeurons = useCallback(async () => {
    if (!clusterId) {
      setNeurons([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.get<Neuron[]>(`/api/neurons/cluster/${clusterId}`);
      setNeurons(data);
    } catch (err) {
      console.error("Failed to fetch neurons:", err);
    } finally {
      setLoading(false);
    }
  }, [clusterId]);

  useEffect(() => {
    fetchNeurons();
  }, [fetchNeurons]);

  const createNeuron = async (title: string, brainId: string) => {
    if (!clusterId) return;
    const neuron = await api.post<Neuron>("/api/neurons", {
      title,
      brainId,
      clusterId,
    });
    setNeurons((prev) => [...prev, neuron]);
    return neuron;
  };

  const deleteNeuron = async (id: string) => {
    await api.delete(`/api/neurons/${id}`);
    setNeurons((prev) => prev.filter((n) => n.id !== id));
  };

  return { neurons, loading, createNeuron, deleteNeuron, refetch: fetchNeurons };
}
