import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useClusters } from '@/lib/hooks/useClusters';
import { server } from '../../../mocks/server';
import { createWrapper } from '../../../utils/createWrapper';
import type { Cluster } from '@/types';

const API_BASE = 'http://localhost:8080';

const makeCluster = (overrides: Partial<Cluster> = {}): Cluster => ({
  id: 'cluster-1',
  brainId: 'brain-1',
  name: 'Test Cluster',
  type: 'knowledge',
  status: 'ready',
  researchGoal: null,
  sortOrder: 0,
  isArchived: false,
  createdAt: '2024-01-01T00:00:00',
  updatedAt: '2024-01-01T00:00:00',
  ...overrides,
});

describe('useClusters', () => {
  it('returns empty clusters when brainId is null', async () => {
    const { result } = renderHook(() => useClusters(null), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.clusters).toEqual([]);
  });

  it('fetches clusters when brainId is provided', async () => {
    const mockClusters = [
      makeCluster(),
      makeCluster({ id: 'cluster-2', name: 'Second Cluster' }),
    ];
    server.use(
      http.get(`${API_BASE}/api/clusters/brain/:brainId`, () =>
        HttpResponse.json(mockClusters)
      )
    );

    const { result } = renderHook(() => useClusters('brain-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.clusters).toHaveLength(2);
    expect(result.current.clusters[0].name).toBe('Test Cluster');
    expect(result.current.clusters[1].name).toBe('Second Cluster');
  });
});
