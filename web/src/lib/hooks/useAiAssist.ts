"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import type {
  AiAssistQuestionAnswer,
  AiAssistRequest,
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
  const [stage, setStage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const invokeWithStream = useCallback(
    async (body: AiAssistRequest, controller: AbortController) => {
      // Try streaming first, fall back to blocking invoke
      try {
        for await (const event of api.aiAssist.stream(
          neuronId, sectionId, body, controller.signal,
        )) {
          if (controller.signal.aborted) return;
          if (event.stage === "complete" && event.data) {
            handleResponse(event.data);
            return;
          } else if (event.stage === "error") {
            setError(event.message || "AI service error");
            return;
          } else {
            setStage(event.stage);
          }
        }
      } catch {
        if (controller.signal.aborted) return;
        // Stream failed — fall back to blocking invoke
        const resp = await api.aiAssist.invoke(
          neuronId, sectionId, body, controller.signal,
        );
        handleResponse(resp);
      }
    },
    [neuronId, sectionId, handleResponse],
  );

  const sendMessage = useCallback(
    async (
      userMessage: string,
      questionAnswers?: AiAssistQuestionAnswer[],
    ) => {
      const userTurn: ConversationTurn = {
        role: "user",
        content: questionAnswers
          ? { type: "answers", answers: questionAnswers }
          : { type: "text", text: userMessage },
      };
      setConversationHistory((prev) => [...prev, userTurn]);
      setLoading(true);
      setError(null);
      setStage(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        await invokeWithStream({
          sectionType,
          currentContent,
          userMessage,
          conversationHistory,
          questionAnswers,
        }, controller);
      } catch (e) {
        if (controller.signal.aborted) {
          setConversationHistory((prev) => prev.slice(0, -1));
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to communicate with AI service");
      } finally {
        abortControllerRef.current = null;
        setLoading(false);
        setStage(null);
      }
    },
    [neuronId, sectionId, sectionType, currentContent, conversationHistory, invokeWithStream],
  );

  const regenerate = useCallback(async () => {
    setConversationHistory((prev) => [
      ...prev,
      { role: "user", content: { type: "text", text: "[Regenerate]" } },
    ]);
    setLoading(true);
    setError(null);
    setStage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await invokeWithStream({
        sectionType,
        currentContent,
        userMessage: "",
        conversationHistory,
        regenerate: true,
      }, controller);
    } catch (e) {
      if (controller.signal.aborted) {
        setConversationHistory((prev) => prev.slice(0, -1));
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to communicate with AI service");
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
      setStage(null);
    }
  }, [neuronId, sectionId, sectionType, currentContent, conversationHistory, invokeWithStream]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const undo = useCallback(() => {
    if (contentStack.length > 1) {
      setContentStack((prev) => prev.slice(0, -1));
    }
  }, [contentStack.length]);

  const canUndo = contentStack.length > 1;

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setConversationHistory([]);
    setContentStack([initialContent]);
    setError(null);
    setStage(null);
  }, [initialContent]);

  return {
    conversationHistory,
    currentContent,
    loading,
    error,
    stage,
    sendMessage,
    regenerate,
    cancel,
    undo,
    canUndo,
    reset,
  };
}
