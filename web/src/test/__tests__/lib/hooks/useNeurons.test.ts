import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useNeurons } from '@/lib/hooks/useNeurons';
import { server } from '../../../mocks/server';
import { createWrapper } from '../../../utils/createWrapper';
import type { Neuron } from '@/types';

const API_BASE = 'http://localhost:8080';

const makeNeuron = (overrides: Partial<Neuron> = {}): Neuron => ({
  id: 'neuron-1',
  brainId: 'brain-1',
  clusterId: 'cluster-1',
  title: 'Test Neuron',
  contentJson: null,
  contentText: null,
  templateId: null,
  isArchived: false,
  isDeleted: false,
  isFavorite: false,
  isPinned: false,
  version: 1,
  createdAt: '2024-01-01T00:00:00',
  updatedAt: '2024-01-01T00:00:00',
  lastEditedAt: '2024-01-01T00:00:00',
  ...overrides,
});

describe('useNeurons', () => {
  it('returns empty neurons when clusterId is null', async () => {
    const { result } = renderHook(() => useNeurons(null), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.neurons).toEqual([]);
  });

  it('fetches neurons when clusterId is provided', async () => {
    const mockNeurons = [
      makeNeuron(),
      makeNeuron({ id: 'neuron-2', title: 'Second Neuron' }),
    ];
    server.use(
      http.get(`${API_BASE}/api/neurons/cluster/:clusterId`, () =>
        HttpResponse.json(mockNeurons)
      )
    );

    const { result } = renderHook(() => useNeurons('cluster-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.neurons).toHaveLength(2);
    expect(result.current.neurons[0].title).toBe('Test Neuron');
    expect(result.current.neurons[1].title).toBe('Second Neuron');
  });
});
