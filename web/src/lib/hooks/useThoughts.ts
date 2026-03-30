"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Thought } from "@/types";

export function useThoughts() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchThoughts = useCallback(async () => {
    try {
      const data = await api.thoughts.list();
      setThoughts(data);
    } catch (err) {
      console.error("Failed to fetch thoughts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThoughts();
  }, [fetchThoughts]);

  const createThought = async (body: {
    name: string;
    description?: string;
    neuronTagMode?: string;
    brainTagMode?: string;
    neuronTagIds: string[];
    brainTagIds?: string[];
  }) => {
    const thought = await api.thoughts.create(body);
    setThoughts((prev) => [...prev, thought]);
    return thought;
  };

  const updateThought = async (id: string, body: {
    name: string;
    description?: string;
    neuronTagMode?: string;
    brainTagMode?: string;
    neuronTagIds: string[];
    brainTagIds?: string[];
  }) => {
    const thought = await api.thoughts.update(id, body);
    setThoughts((prev) => prev.map((t) => (t.id === id ? thought : t)));
    return thought;
  };

  const deleteThought = async (id: string) => {
    await api.thoughts.delete(id);
    setThoughts((prev) => prev.filter((t) => t.id !== id));
  };

  return { thoughts, loading, createThought, updateThought, deleteThought, refetch: fetchThoughts };
}
