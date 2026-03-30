"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { NeuronLink } from "@/types";

export function useNeuronLinks(neuronId: string | null) {
  const [links, setLinks] = useState<NeuronLink[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLinks = useCallback(async () => {
    if (!neuronId) {
      setLinks([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.neuronLinks.getForNeuron<NeuronLink[]>(neuronId);
      setLinks(data);
    } catch (err) {
      console.error("Failed to fetch neuron links:", err);
    } finally {
      setLoading(false);
    }
  }, [neuronId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const createLink = async (
    sourceNeuronId: string,
    targetNeuronId: string,
    label?: string,
    linkType?: string
  ) => {
    const link = await api.neuronLinks.create<NeuronLink>({
      sourceNeuronId,
      targetNeuronId,
      label,
      linkType,
    });
    setLinks((prev) => [...prev, link]);
    return link;
  };

  const deleteLink = async (id: string) => {
    await api.neuronLinks.delete(id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  return { links, loading, createLink, deleteLink, refetch: fetchLinks };
}
