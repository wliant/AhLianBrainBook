import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useNeuronAnchors, useFileAnchors } from '@/lib/hooks/useNeuronAnchors';
import { server } from '../../../mocks/server';
import { createWrapper } from '../../../utils/createWrapper';

const API_BASE = 'http://localhost:8080';

const mockAnchor = {
  id: 'anchor-1',
  neuronId: 'neuron-1',
  clusterId: 'cluster-1',
  filePath: 'src/Main.java',
  createdAt: '2024-01-01T00:00:00',
  updatedAt: '2024-01-01T00:00:00',
};

describe('useNeuronAnchors', () => {
  it('returns empty anchors when clusterId is null', async () => {
    const { result } = renderHook(() => useNeuronAnchors(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.anchors).toEqual([]);
  });

  it('fetches anchors when clusterId is provided', async () => {
    server.use(
      http.get(`${API_BASE}/api/neuron-anchors/cluster/:clusterId`, () =>
        HttpResponse.json({ content: [mockAnchor], totalElements: 1 })
      )
    );

    const { result } = renderHook(() => useNeuronAnchors('cluster-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.anchors).toHaveLength(1);
    expect(result.current.anchors[0].filePath).toBe('src/Main.java');
  });
});

describe('useFileAnchors', () => {
  it('returns empty when path is null', async () => {
    const { result } = renderHook(() => useFileAnchors('cluster-1', null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.anchors).toEqual([]);
  });

  it('fetches anchors for a specific file', async () => {
    server.use(
      http.get(`${API_BASE}/api/neuron-anchors/cluster/:clusterId/file`, () =>
        HttpResponse.json({ content: [mockAnchor], totalElements: 1 })
      )
    );

    const { result } = renderHook(
      () => useFileAnchors('cluster-1', 'src/Main.java'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.anchors).toHaveLength(1);
    expect(result.current.anchors[0].filePath).toBe('src/Main.java');
  });
});
