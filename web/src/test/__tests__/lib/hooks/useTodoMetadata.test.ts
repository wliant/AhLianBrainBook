import { describe, it, expect } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useTodoMetadata, useTodoClusterMetadata } from "@/lib/hooks/useTodoMetadata";
import { server } from "../../../mocks/server";
import { createWrapper } from "../../../utils/createWrapper";
import type { TodoMetadata } from "@/types";

const API_BASE = "http://localhost:8080";

function makeTodoMetadata(overrides: Partial<TodoMetadata> = {}): TodoMetadata {
  return {
    neuronId: "neuron-1",
    dueDate: null,
    completed: false,
    completedAt: null,
    effort: null,
    priority: "normal",
    createdAt: "2024-01-01T00:00:00",
    updatedAt: "2024-01-01T00:00:00",
    ...overrides,
  };
}

describe("useTodoMetadata", () => {
  it("fetches metadata on mount", async () => {
    const mockMeta = makeTodoMetadata({ priority: "critical", dueDate: "2024-12-25" });
    server.use(
      http.get(`${API_BASE}/api/neurons/neuron-1/todo`, () =>
        HttpResponse.json(mockMeta)
      )
    );

    const { result } = renderHook(() => useTodoMetadata("neuron-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metadata).not.toBeNull();
    expect(result.current.metadata!.priority).toBe("critical");
    expect(result.current.metadata!.dueDate).toBe("2024-12-25");
  });

  it("returns null metadata when neuronId is null", async () => {
    const { result } = renderHook(() => useTodoMetadata(null), {
      wrapper: createWrapper(),
    });

    // Should not fetch (disabled), metadata stays null
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metadata).toBeNull();
  });

  it("updateMetadata calls API and updates cache", async () => {
    const initialMeta = makeTodoMetadata();
    const updatedMeta = makeTodoMetadata({ completed: true, completedAt: "2024-06-15T10:00:00" });

    server.use(
      http.get(`${API_BASE}/api/neurons/neuron-1/todo`, () =>
        HttpResponse.json(initialMeta)
      ),
      http.patch(`${API_BASE}/api/neurons/neuron-1/todo`, () =>
        HttpResponse.json(updatedMeta)
      )
    );

    const { result } = renderHook(() => useTodoMetadata("neuron-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateMetadata({ completed: true });
    });

    await waitFor(() => {
      expect(result.current.metadata?.completed).toBe(true);
    });
  });
});

describe("useTodoClusterMetadata", () => {
  it("fetches cluster metadata map on mount", async () => {
    const metadataMap: Record<string, TodoMetadata> = {
      "n-1": makeTodoMetadata({ neuronId: "n-1", priority: "critical" }),
      "n-2": makeTodoMetadata({ neuronId: "n-2", completed: true, completedAt: "2024-06-01T00:00:00" }),
    };

    server.use(
      http.get(`${API_BASE}/api/clusters/cluster-1/todo`, () =>
        HttpResponse.json(metadataMap)
      )
    );

    const { result } = renderHook(() => useTodoClusterMetadata("cluster-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metadataMap["n-1"]).toBeDefined();
    expect(result.current.metadataMap["n-1"].priority).toBe("critical");
    expect(result.current.metadataMap["n-2"].completed).toBe(true);
  });

  it("returns empty map when clusterId is null", async () => {
    const { result } = renderHook(() => useTodoClusterMetadata(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metadataMap).toEqual({});
  });
});
