import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useThoughts } from '@/lib/hooks/useThoughts';
import { server } from '../../../mocks/server';
import { createWrapper } from '../../../utils/createWrapper';
import type { Thought } from '@/types';

const API_BASE = 'http://localhost:8080';

const makeThought = (overrides: Partial<Thought> = {}): Thought => ({
  id: 'thought-1',
  name: 'Test Thought',
  description: null,
  neuronTagMode: 'any',
  brainTagMode: 'any',
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00',
  updatedAt: '2024-01-01T00:00:00',
  neuronTags: [],
  brainTags: [],
  ...overrides,
});

describe('useThoughts', () => {
  it('fetches thoughts on mount', async () => {
    const mockThoughts = [makeThought(), makeThought({ id: 'thought-2', name: 'Second' })];
    server.use(
      http.get(`${API_BASE}/api/thoughts`, () => HttpResponse.json(mockThoughts))
    );

    const { result } = renderHook(() => useThoughts(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.thoughts).toHaveLength(2);
    expect(result.current.thoughts[0].name).toBe('Test Thought');
    expect(result.current.thoughts[1].name).toBe('Second');
  });

  it('createThought triggers refetch', async () => {
    let callCount = 0;
    server.use(
      http.get(`${API_BASE}/api/thoughts`, () => {
        callCount++;
        if (callCount === 1) return HttpResponse.json([]);
        return HttpResponse.json([makeThought({ name: 'New Thought' })]);
      }),
      http.post(`${API_BASE}/api/thoughts`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeThought({ name: body.name as string }), {
          status: 201,
        });
      })
    );

    const { result } = renderHook(() => useThoughts(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.createThought({
        name: 'New Thought',
        neuronTagIds: ['tag-1'],
      });
    });

    await waitFor(() => {
      expect(result.current.thoughts).toHaveLength(1);
    });
    expect(result.current.thoughts[0].name).toBe('New Thought');
  });

  it('deleteThought triggers refetch', async () => {
    const mockThoughts = [makeThought(), makeThought({ id: 'thought-2', name: 'Second' })];
    let callCount = 0;
    server.use(
      http.get(`${API_BASE}/api/thoughts`, () => {
        callCount++;
        if (callCount === 1) return HttpResponse.json(mockThoughts);
        return HttpResponse.json([mockThoughts[1]]);
      }),
      http.delete(`${API_BASE}/api/thoughts/:id`, () => new HttpResponse(null, { status: 204 }))
    );

    const { result } = renderHook(() => useThoughts(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.thoughts).toHaveLength(2);
    });

    await act(async () => {
      await result.current.deleteThought('thought-1');
    });

    await waitFor(() => {
      expect(result.current.thoughts).toHaveLength(1);
    });
    expect(result.current.thoughts[0].id).toBe('thought-2');
  });

  it('updateThought triggers refetch', async () => {
    let callCount = 0;
    server.use(
      http.get(`${API_BASE}/api/thoughts`, () => {
        callCount++;
        if (callCount === 1) return HttpResponse.json([makeThought()]);
        return HttpResponse.json([makeThought({ name: 'Updated Name' })]);
      }),
      http.patch(`${API_BASE}/api/thoughts/:id`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeThought({ name: body.name as string }));
      })
    );

    const { result } = renderHook(() => useThoughts(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.thoughts).toHaveLength(1);
    });

    await act(async () => {
      await result.current.updateThought('thought-1', {
        name: 'Updated Name',
        neuronTagIds: ['tag-1'],
      });
    });

    await waitFor(() => {
      expect(result.current.thoughts[0].name).toBe('Updated Name');
    });
  });
});
