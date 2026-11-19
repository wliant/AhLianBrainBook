import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useSpacedRepetition } from '@/lib/hooks/useSpacedRepetition';
import { server } from '../../../mocks/server';
import { createWrapper } from '../../../utils/createWrapper';
import type { SpacedRepetitionItem } from '@/types';

// The app issues relative URLs now - one origin serves both the UI and the
// API - so handlers must be registered against the page's own origin.
const API_BASE = window.location.origin;

const makeSRItem = (overrides: Partial<SpacedRepetitionItem> = {}): SpacedRepetitionItem => ({
  id: 'sr-1',
  neuronId: 'neuron-1',
  neuronTitle: 'Test Neuron',
  brainId: 'brain-1',
  clusterId: 'cluster-1',
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
  nextReviewAt: new Date().toISOString(),
  lastReviewedAt: null,
  createdAt: '2024-01-01T00:00:00',
  questionCount: 5,
  hasQuestions: false,
  quizEligible: false,
  quizEnabled: true,
  choiceQuestionsEnabled: true,
  ...overrides,
});

describe('useSpacedRepetition', () => {
  it('fetches queue on mount', async () => {
    const mockQueue = [makeSRItem()];
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/queue`, () => HttpResponse.json(mockQueue))
    );

    const { result } = renderHook(() => useSpacedRepetition(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.queueLoading).toBe(false);
    });

    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].neuronId).toBe('neuron-1');
  });

  it('fetches allItems on mount', async () => {
    const mockItems = [makeSRItem(), makeSRItem({ id: 'sr-2', neuronId: 'neuron-2' })];
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items`, () => HttpResponse.json(mockItems))
    );

    const { result } = renderHook(() => useSpacedRepetition(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.itemsLoading).toBe(false);
    });

    expect(result.current.allItems).toHaveLength(2);
  });

  it('addToReview calls POST and invalidates queries', async () => {
    let getCallCount = 0;
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items`, () => {
        getCallCount++;
        if (getCallCount === 1) return HttpResponse.json([]);
        return HttpResponse.json([makeSRItem()]);
      }),
      http.post(`${API_BASE}/api/spaced-repetition/items/:neuronId`, () =>
        HttpResponse.json(makeSRItem(), { status: 201 })
      )
    );

    const { result } = renderHook(() => useSpacedRepetition(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.itemsLoading).toBe(false);
    });

    await act(async () => {
      await result.current.addToReview('neuron-1');
    });

    await waitFor(() => {
      expect(result.current.allItems).toHaveLength(1);
    });
  });

  it('removeFromReview calls DELETE and invalidates queries', async () => {
    let getCallCount = 0;
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items`, () => {
        getCallCount++;
        if (getCallCount === 1) return HttpResponse.json([makeSRItem()]);
        return HttpResponse.json([]);
      }),
      http.delete(`${API_BASE}/api/spaced-repetition/items/:neuronId`, () =>
        new HttpResponse(null, { status: 204 })
      )
    );

    const { result } = renderHook(() => useSpacedRepetition(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.allItems).toHaveLength(1);
    });

    await act(async () => {
      await result.current.removeFromReview('neuron-1');
    });

    await waitFor(() => {
      expect(result.current.allItems).toHaveLength(0);
    });
  });

  it('submitReview calls POST and invalidates queries', async () => {
    const reviewed = makeSRItem({ repetitions: 1, intervalDays: 1 });
    server.use(
      http.post(`${API_BASE}/api/spaced-repetition/items/:itemId/review`, () =>
        HttpResponse.json(reviewed)
      )
    );

    const { result } = renderHook(() => useSpacedRepetition(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.queueLoading).toBe(false);
    });

    let reviewResult: SpacedRepetitionItem | undefined;
    await act(async () => {
      reviewResult = await result.current.submitReview('sr-1', 4);
    });

    expect(reviewResult?.repetitions).toBe(1);
    expect(reviewResult?.intervalDays).toBe(1);
  });

  it('regenerateQuestions calls POST and invalidates queries', async () => {
    let postCalled = false;
    let getCallCount = 0;
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items`, () => {
        getCallCount++;
        // Before regenerate: questions ready. After: re-fetched with fresh questions.
        return HttpResponse.json([makeSRItem({ hasQuestions: getCallCount > 1 })]);
      }),
      http.post(`${API_BASE}/api/spaced-repetition/items/:itemId/questions/regenerate`, () => {
        postCalled = true;
        return new HttpResponse(null, { status: 202 });
      })
    );

    const { result } = renderHook(() => useSpacedRepetition(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.itemsLoading).toBe(false);
    });

    await act(async () => {
      await result.current.regenerateQuestions('sr-1');
    });

    expect(postCalled).toBe(true);
    await waitFor(() => {
      expect(result.current.allItems[0]?.hasQuestions).toBe(true);
    });
  });

  it('exposes refetchItems and refetchQueue', async () => {
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items`, () => HttpResponse.json([makeSRItem()]))
    );

    const { result } = renderHook(() => useSpacedRepetition(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.itemsLoading).toBe(false);
    });

    expect(typeof result.current.refetchItems).toBe('function');
    expect(typeof result.current.refetchQueue).toBe('function');

    let refetched: SpacedRepetitionItem[] | undefined;
    await act(async () => {
      const res = await result.current.refetchItems();
      refetched = res.data;
    });
    expect(refetched).toHaveLength(1);
  });

  it('isInReview returns true when neuron is in allItems', async () => {
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items`, () =>
        HttpResponse.json([makeSRItem({ neuronId: 'neuron-1' })])
      )
    );

    const { result } = renderHook(() => useSpacedRepetition(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.itemsLoading).toBe(false);
    });

    expect(result.current.isInReview('neuron-1')).toBe(true);
  });

  it('isInReview returns false when neuron is not in allItems', async () => {
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items`, () => HttpResponse.json([]))
    );

    const { result } = renderHook(() => useSpacedRepetition(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.itemsLoading).toBe(false);
    });

    expect(result.current.isInReview('neuron-1')).toBe(false);
  });
});
