import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAiAssist } from "@/lib/hooks/useAiAssist";
import { api } from "@/lib/api";
import type { AiAssistResponse } from "@/types";

vi.mock("@/lib/api", () => ({
  api: {
    aiAssist: {
      invoke: vi.fn(),
    },
  },
}));

const mockInvoke = vi.mocked(api.aiAssist.invoke);

function makeContentResponse(
  content: Record<string, unknown>,
  history = [],
): AiAssistResponse {
  return {
    responseType: "content",
    sectionContent: content,
    explanation: "Generated",
    conversationHistory: history.length
      ? history
      : [
          { role: "user", content: { type: "text", text: "generate" } },
          {
            role: "assistant",
            content: { type: "section_content", sectionContent: content },
          },
        ],
  };
}

function makeQuestionsResponse(): AiAssistResponse {
  return {
    responseType: "questions",
    questions: [
      {
        id: "q1",
        text: "Which language?",
        inputType: "single-select",
        options: ["Python", "JS"],
      },
    ],
    explanation: "Need info",
    conversationHistory: [
      { role: "user", content: { type: "text", text: "help" } },
      {
        role: "assistant",
        content: {
          type: "questions",
          questions: [
            {
              id: "q1",
              text: "Which language?",
              inputType: "single-select",
              options: ["Python", "JS"],
            },
          ],
        },
      },
    ],
  };
}

describe("useAiAssist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with initial content and empty history", () => {
    const initial = { code: "", language: "javascript" };
    const { result } = renderHook(() =>
      useAiAssist("n1", "s1", "code", initial),
    );

    expect(result.current.conversationHistory).toHaveLength(0);
    expect(result.current.currentContent).toEqual(initial);
    expect(result.current.loading).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it("sendMessage updates conversation and content on content response", async () => {
    const newContent = { code: "print('hi')", language: "python" };
    mockInvoke.mockResolvedValueOnce(makeContentResponse(newContent));

    const { result } = renderHook(() =>
      useAiAssist("n1", "s1", "code", null),
    );

    await act(async () => {
      await result.current.sendMessage("Write code");
    });

    expect(result.current.currentContent).toEqual(newContent);
    expect(result.current.conversationHistory).toHaveLength(2);
    expect(result.current.canUndo).toBe(true);
  });

  it("sendMessage sets error on failure", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() =>
      useAiAssist("n1", "s1", "code", null),
    );

    await act(async () => {
      await result.current.sendMessage("Write code");
    });

    expect(result.current.error).toBe("Network error");
  });

  it("undo reverts to previous content", async () => {
    const initial = { code: "", language: "javascript" };
    const generated = { code: "print('hi')", language: "python" };
    mockInvoke.mockResolvedValueOnce(makeContentResponse(generated));

    const { result } = renderHook(() =>
      useAiAssist("n1", "s1", "code", initial),
    );

    await act(async () => {
      await result.current.sendMessage("Write code");
    });

    expect(result.current.currentContent).toEqual(generated);

    act(() => {
      result.current.undo();
    });

    expect(result.current.currentContent).toEqual(initial);
    expect(result.current.canUndo).toBe(false);
  });

  it("regenerate sends request with regenerate flag", async () => {
    const content1 = { code: "v1", language: "python" };
    const content2 = { code: "v2", language: "python" };
    mockInvoke
      .mockResolvedValueOnce(makeContentResponse(content1))
      .mockResolvedValueOnce(makeContentResponse(content2));

    const { result } = renderHook(() =>
      useAiAssist("n1", "s1", "code", null),
    );

    await act(async () => {
      await result.current.sendMessage("Write code");
    });

    await act(async () => {
      await result.current.regenerate();
    });

    expect(mockInvoke).toHaveBeenLastCalledWith(
      "n1",
      "s1",
      expect.objectContaining({ regenerate: true }),
      expect.any(AbortSignal),
    );
    expect(result.current.currentContent).toEqual(content2);
  });

  it("reset clears all state", async () => {
    const initial = { code: "", language: "javascript" };
    const generated = { code: "print('hi')", language: "python" };
    mockInvoke.mockResolvedValueOnce(makeContentResponse(generated));

    const { result } = renderHook(() =>
      useAiAssist("n1", "s1", "code", initial),
    );

    await act(async () => {
      await result.current.sendMessage("Write code");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.conversationHistory).toHaveLength(0);
    expect(result.current.currentContent).toEqual(initial);
    expect(result.current.canUndo).toBe(false);
  });

  it("handles questions response without updating content", async () => {
    mockInvoke.mockResolvedValueOnce(makeQuestionsResponse());

    const initial = { code: "", language: "javascript" };
    const { result } = renderHook(() =>
      useAiAssist("n1", "s1", "code", initial),
    );

    await act(async () => {
      await result.current.sendMessage("help");
    });

    expect(result.current.currentContent).toEqual(initial);
    expect(result.current.conversationHistory).toHaveLength(2);
    expect(result.current.canUndo).toBe(false);
  });

  it("cancel aborts in-flight request and clears loading", async () => {
    // Make the API hang until abort
    mockInvoke.mockImplementation(
      (_nId, _sId, _body, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("Aborted"), { name: "AbortError" })),
          );
        }),
    );

    const initial = { code: "", language: "javascript" };
    const { result } = renderHook(() =>
      useAiAssist("n1", "s1", "code", initial),
    );

    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage("Write code");
    });

    // Cancel while request is in-flight
    act(() => {
      result.current.cancel();
    });

    await act(async () => {
      await sendPromise!;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    // Optimistic user turn is removed on cancel
    expect(result.current.conversationHistory).toHaveLength(0);
  });

  it("cancel during regenerate aborts and clears loading", async () => {
    const content1 = { code: "v1", language: "python" };
    mockInvoke
      .mockResolvedValueOnce(makeContentResponse(content1))
      .mockImplementation(
        (_nId, _sId, _body, signal?: AbortSignal) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener("abort", () =>
              reject(Object.assign(new Error("Aborted"), { name: "AbortError" })),
            );
          }),
      );

    const { result } = renderHook(() =>
      useAiAssist("n1", "s1", "code", null),
    );

    // First: generate content
    await act(async () => {
      await result.current.sendMessage("Write code");
    });
    expect(result.current.currentContent).toEqual(content1);

    // Second: regenerate, then cancel
    let regenPromise: Promise<void>;
    act(() => {
      regenPromise = result.current.regenerate();
    });

    act(() => {
      result.current.cancel();
    });

    await act(async () => {
      await regenPromise!;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    // Content is still the first generated content
    expect(result.current.currentContent).toEqual(content1);
  });
});
