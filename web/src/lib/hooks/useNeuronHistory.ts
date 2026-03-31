"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Neuron, NeuronRevision } from "@/types";

export function useNeuronHistory(neuronId: string | null) {
  const [revisions, setRevisions] = useState<NeuronRevision[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRevisions = useCallback(async () => {
    if (!neuronId) {
      setRevisions([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.revisions.list(neuronId);
      setRevisions(data);
    } catch (err) {
      console.error("Failed to fetch neuron history:", err);
    } finally {
      setLoading(false);
    }
  }, [neuronId]);

  useEffect(() => {
    fetchRevisions();
  }, [fetchRevisions]);

  const createSnapshot = async () => {
    if (!neuronId) return;
    const revision = await api.revisions.create(neuronId);
    await fetchRevisions();
    return revision;
  };

  const restoreRevision = async (revisionId: string): Promise<Neuron> => {
    const neuron = await api.revisions.restore(revisionId);
    return neuron;
  };

  const deleteRevision = async (revisionId: string) => {
    await api.revisions.delete(revisionId);
    setRevisions((prev) => prev.filter((r) => r.id !== revisionId));
  };

  return { revisions, loading, createSnapshot, restoreRevision, deleteRevision, refetch: fetchRevisions };
}
