"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type {
  AiAssistQuestionAnswer,
  AiAssistResponse,
  ConversationTurn,
  SectionType,
} from "@/types";

export function useAiAssist(
  neuronId: string,
  sectionId: string,
  sectionType: SectionType,
  initialContent: Record<string, unknown> | null,
) {
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [contentStack, setContentStack] = useState<(Record<string, unknown> | null)[]>([
    initialContent,
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentContent = contentStack[contentStack.length - 1];

  const handleResponse = useCallback(
    (resp: AiAssistResponse) => {
      setConversationHistory(resp.conversationHistory);
      setError(null);

      if (resp.responseType === "content" && resp.sectionContent) {
        setContentStack((prev) => [...prev, resp.sectionContent!]);
      } else if (resp.responseType === "message" && resp.messageSeverity === "error") {
        setError(resp.message || "An error occurred");
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (
      userMessage: string,
      questionAnswers?: AiAssistQuestionAnswer[],
    ) => {
      // Optimistically show user message immediately
      const userTurn: ConversationTurn = {
        role: "user",
        content: questionAnswers
          ? { type: "answers", answers: questionAnswers }
          : { type: "text", text: userMessage },
      };
      setConversationHistory((prev) => [...prev, userTurn]);
      setLoading(true);
      setError(null);
      try {
        const resp = await api.aiAssist.invoke(neuronId, sectionId, {
          sectionType,
          currentContent,
          userMessage,
          conversationHistory,
          questionAnswers,
        });
        handleResponse(resp);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to communicate with AI service");
      } finally {
        setLoading(false);
      }
    },
    [neuronId, sectionId, sectionType, currentContent, conversationHistory, handleResponse],
  );

  const regenerate = useCallback(async () => {
    setConversationHistory((prev) => [
      ...prev,
      { role: "user", content: { type: "text", text: "[Regenerate]" } },
    ]);
    setLoading(true);
    setError(null);
    try {
      const resp = await api.aiAssist.invoke(neuronId, sectionId, {
        sectionType,
        currentContent,
        userMessage: "",
        conversationHistory,
        regenerate: true,
      });
      handleResponse(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to communicate with AI service");
    } finally {
      setLoading(false);
    }
  }, [neuronId, sectionId, sectionType, currentContent, conversationHistory, handleResponse]);

  const undo = useCallback(() => {
    if (contentStack.length > 1) {
      setContentStack((prev) => prev.slice(0, -1));
    }
  }, [contentStack.length]);

  const canUndo = contentStack.length > 1;

  const reset = useCallback(() => {
    setConversationHistory([]);
    setContentStack([initialContent]);
    setError(null);
  }, [initialContent]);

  return {
    conversationHistory,
    currentContent,
    loading,
    error,
    sendMessage,
    regenerate,
    undo,
    canUndo,
    reset,
  };
}
