"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCallback } from "react";

export function useSpacedRepetition() {
  const queryClient = useQueryClient();

  const { data: queue = [], isLoading: queueLoading } = useQuery({
    queryKey: ["sr-queue"],
    queryFn: () => api.spacedRepetition.getQueue(),
  });

  const { data: allItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["sr-items"],
    queryFn: () => api.spacedRepetition.getAllItems(),
  });

  const addToReview = useCallback(async (neuronId: string) => {
    await api.spacedRepetition.addItem(neuronId);
    queryClient.invalidateQueries({ queryKey: ["sr-items"] });
    queryClient.invalidateQueries({ queryKey: ["sr-queue"] });
  }, [queryClient]);

  const removeFromReview = useCallback(async (neuronId: string) => {
    await api.spacedRepetition.removeItem(neuronId);
    queryClient.invalidateQueries({ queryKey: ["sr-items"] });
    queryClient.invalidateQueries({ queryKey: ["sr-queue"] });
  }, [queryClient]);

  const submitReview = useCallback(async (itemId: string, quality: number) => {
    const result = await api.spacedRepetition.submitReview(itemId, quality);
    queryClient.invalidateQueries({ queryKey: ["sr-queue"] });
    queryClient.invalidateQueries({ queryKey: ["sr-items"] });
    return result;
  }, [queryClient]);

  const isInReview = useCallback((neuronId: string) => {
    return allItems.some((item) => item.neuronId === neuronId);
  }, [allItems]);

  return {
    queue,
    queueLoading,
    allItems,
    itemsLoading,
    addToReview,
    removeFromReview,
    submitReview,
    isInReview,
  };
}
