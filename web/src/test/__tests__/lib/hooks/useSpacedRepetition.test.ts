import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useSpacedRepetition } from '@/lib/hooks/useSpacedRepetition';
import { server } from '../../../mocks/server';
import { createWrapper } from '../../../utils/createWrapper';
import type { SpacedRepetitionItem } from '@/types';

const API_BASE = 'http://localhost:8080';

const makeSRItem = (overrides: Partial<SpacedRepetitionItem> = {}): SpacedRepetitionItem => ({
  id: 'sr-1',
  neuronId: 'neuron-1',
  neuronTitle: 'Test Neuron',
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
