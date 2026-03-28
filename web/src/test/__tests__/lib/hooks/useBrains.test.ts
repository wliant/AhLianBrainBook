import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useBrains } from '@/lib/hooks/useBrains';
import { server } from '../../../mocks/server';
import type { Brain } from '@/types';

const API_BASE = 'http://localhost:8080';

const makeBrain = (overrides: Partial<Brain> = {}): Brain => ({
  id: 'brain-1',
  name: 'Test Brain',
  icon: null,
  color: null,
  sortOrder: 0,
  isArchived: false,
  createdAt: '2024-01-01T00:00:00',
  updatedAt: '2024-01-01T00:00:00',
  ...overrides,
});

describe('useBrains', () => {
  it('fetches brains on mount', async () => {
    const mockBrains = [makeBrain(), makeBrain({ id: 'brain-2', name: 'Second Brain' })];
    server.use(
      http.get(`${API_BASE}/api/brains`, () => HttpResponse.json(mockBrains))
    );

    const { result } = renderHook(() => useBrains());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.brains).toHaveLength(2);
    expect(result.current.brains[0].name).toBe('Test Brain');
    expect(result.current.brains[1].name).toBe('Second Brain');
  });

  it('createBrain adds brain to list', async () => {
    server.use(
      http.get(`${API_BASE}/api/brains`, () => HttpResponse.json([])),
      http.post(`${API_BASE}/api/brains`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeBrain({ name: body.name as string }), {
          status: 201,
        });
      })
    );

    const { result } = renderHook(() => useBrains());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.createBrain('New Brain');
    });

    expect(result.current.brains).toHaveLength(1);
    expect(result.current.brains[0].name).toBe('New Brain');
  });

  it('deleteBrain removes brain from list', async () => {
    const mockBrains = [makeBrain(), makeBrain({ id: 'brain-2', name: 'Second Brain' })];
    server.use(
      http.get(`${API_BASE}/api/brains`, () => HttpResponse.json(mockBrains))
    );

    const { result } = renderHook(() => useBrains());

    await waitFor(() => {
      expect(result.current.brains).toHaveLength(2);
    });

    await act(async () => {
      await result.current.deleteBrain('brain-1');
    });

    expect(result.current.brains).toHaveLength(1);
    expect(result.current.brains[0].id).toBe('brain-2');
  });
});
