"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Tag } from "@/types";

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    try {
      const data = await api.get<Tag[]>("/api/tags");
      setTags(data);
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const createTag = async (name: string, color?: string) => {
    const tag = await api.post<Tag>("/api/tags", { name, color });
    setTags((prev) => [...prev, tag]);
    return tag;
  };

  const addTagToNeuron = async (neuronId: string, tagId: string) => {
    await api.post<void>(`/api/tags/neurons/${neuronId}/tags/${tagId}`);
  };

  const removeTagFromNeuron = async (neuronId: string, tagId: string) => {
    await api.delete<void>(`/api/tags/neurons/${neuronId}/tags/${tagId}`);
  };

  return { tags, loading, createTag, addTagToNeuron, removeTagFromNeuron, refetch: fetchTags };
}
