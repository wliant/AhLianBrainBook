import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useResearchTopics } from '@/lib/hooks/useResearchTopics';
import { server } from '../../../mocks/server';
import { createWrapper } from '../../../utils/createWrapper';
import type { ResearchTopic } from '@/types';

const API_BASE = 'http://localhost:8080';

const makeTopic = (overrides: Partial<ResearchTopic> = {}): ResearchTopic => ({
  id: 'topic-1',
  clusterId: 'cluster-1',
  brainId: 'brain-1',
  title: 'Refactoring Techniques',
  prompt: 'Refactoring techniques',
  contentJson: {
    version: 1,
    items: [
      {
        id: 'item-1',
        text: 'Extract Method',
        explanation: 'Test',
        completeness: 'none',
        linkedNeuronIds: [],
        children: [],
      },
    ],
  },
  overallCompleteness: 'none',
  lastRefreshedAt: null,
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00',
  updatedAt: '2024-01-01T00:00:00',
  createdBy: 'user',
  lastUpdatedBy: 'user',
  ...overrides,
});

describe('useResearchTopics', () => {
  it('returns empty topics when clusterId is null', async () => {
    const { result } = renderHook(() => useResearchTopics(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.topics).toEqual([]);
  });

  it('fetches topics when clusterId is provided', async () => {
    const mockTopics = [
      makeTopic(),
      makeTopic({ id: 'topic-2', title: 'Design Patterns' }),
    ];
    server.use(
      http.get(`${API_BASE}/api/clusters/:clusterId/research-topics`, () =>
        HttpResponse.json(mockTopics),
      ),
    );

    const { result } = renderHook(() => useResearchTopics('cluster-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.topics).toHaveLength(2);
    expect(result.current.topics[0].title).toBe('Refactoring Techniques');
    expect(result.current.topics[1].title).toBe('Design Patterns');
  });
});
