import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useNeuronHistory } from '@/lib/hooks/useNeuronHistory';
import { server } from '../../../mocks/server';
import type { NeuronRevision } from '@/types';

const API_BASE = 'http://localhost:8080';

const makeRevision = (overrides: Partial<NeuronRevision> = {}): NeuronRevision => ({
  id: 'revision-1',
  neuronId: 'neuron-1',
  revisionNumber: 1,
  title: 'Test Snapshot',
  contentJson: null,
  contentText: null,
  createdAt: '2024-01-01T00:00:00',
  ...overrides,
});

describe('useNeuronHistory', () => {
  it('returns empty revisions when neuronId is null', async () => {
    const { result } = renderHook(() => useNeuronHistory(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.revisions).toEqual([]);
  });

  it('fetches revisions when neuronId is provided', async () => {
    const mockRevisions = [
      makeRevision(),
      makeRevision({ id: 'revision-2', revisionNumber: 2, title: 'Second Snapshot' }),
    ];
    server.use(
      http.get(`${API_BASE}/api/neurons/:neuronId/revisions`, () =>
        HttpResponse.json(mockRevisions)
      )
    );

    const { result } = renderHook(() => useNeuronHistory('neuron-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.revisions).toHaveLength(2);
    expect(result.current.revisions[0].title).toBe('Test Snapshot');
    expect(result.current.revisions[1].title).toBe('Second Snapshot');
  });

  it('createSnapshot creates and refetches', async () => {
    const created = makeRevision({ id: 'new-revision', revisionNumber: 1 });
    server.use(
      http.get(`${API_BASE}/api/neurons/:neuronId/revisions`, () =>
        HttpResponse.json([created])
      ),
      http.post(`${API_BASE}/api/neurons/:neuronId/revisions`, () =>
        HttpResponse.json(created)
      )
    );

    const { result } = renderHook(() => useNeuronHistory('neuron-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.createSnapshot();
    });

    expect(result.current.revisions).toHaveLength(1);
    expect(result.current.revisions[0].id).toBe('new-revision');
  });

  it('deleteRevision removes from local state', async () => {
    const revisions = [
      makeRevision({ id: 'rev-1', revisionNumber: 1 }),
      makeRevision({ id: 'rev-2', revisionNumber: 2 }),
    ];
    server.use(
      http.get(`${API_BASE}/api/neurons/:neuronId/revisions`, () =>
        HttpResponse.json(revisions)
      )
    );

    const { result } = renderHook(() => useNeuronHistory('neuron-1'));

    await waitFor(() => {
      expect(result.current.revisions).toHaveLength(2);
    });

    await act(async () => {
      await result.current.deleteRevision('rev-1');
    });

    expect(result.current.revisions).toHaveLength(1);
    expect(result.current.revisions[0].id).toBe('rev-2');
  });
});
