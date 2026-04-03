import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useSandboxList } from '@/lib/hooks/useSandboxList';
import { server } from '../../../mocks/server';
import { createWrapper } from '../../../utils/createWrapper';

const API_BASE = 'http://localhost:8080';

describe('useSandboxList', () => {
  it('returns empty list by default', async () => {
    const { result } = renderHook(() => useSandboxList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sandboxes).toEqual([]);
  });

  it('fetches active sandboxes', async () => {
    server.use(
      http.get(`${API_BASE}/api/sandboxes`, () =>
        HttpResponse.json([
          {
            id: 'sandbox-1',
            clusterId: 'cluster-1',
            brainId: 'brain-1',
            brainName: 'Test Brain',
            clusterName: 'spring-framework',
            repoUrl: 'https://github.com/spring-projects/spring-framework',
            currentBranch: 'main',
            status: 'active',
            createdAt: '2024-01-01T00:00:00',
            updatedAt: '2024-01-01T00:00:00',
            lastAccessedAt: '2024-01-01T00:00:00',
          },
        ])
      )
    );

    const { result } = renderHook(() => useSandboxList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sandboxes).toHaveLength(1);
    expect(result.current.sandboxes[0].clusterName).toBe('spring-framework');
    expect(result.current.sandboxes[0].status).toBe('active');
  });
});
