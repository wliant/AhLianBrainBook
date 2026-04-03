import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useSandbox } from '@/lib/hooks/useSandbox';
import { server } from '../../../mocks/server';
import { createWrapper } from '../../../utils/createWrapper';

const API_BASE = 'http://localhost:8080';

describe('useSandbox', () => {
  it('returns null sandbox when clusterId is null', async () => {
    const { result } = renderHook(() => useSandbox(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sandbox).toBeNull();
  });

  it('fetches sandbox when clusterId is provided', async () => {
    server.use(
      http.get(`${API_BASE}/api/clusters/:clusterId/sandbox`, () =>
        HttpResponse.json({
          id: 'sandbox-1',
          clusterId: 'cluster-1',
          brainId: 'brain-1',
          status: 'active',
          currentBranch: 'main',
          currentCommit: 'abc123',
          repoUrl: 'https://github.com/owner/repo',
          isShallow: true,
          createdAt: '2024-01-01T00:00:00',
          updatedAt: '2024-01-01T00:00:00',
          lastAccessedAt: '2024-01-01T00:00:00',
        })
      )
    );

    const { result } = renderHook(() => useSandbox('cluster-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sandbox).not.toBeNull();
    expect(result.current.sandbox?.status).toBe('active');
    expect(result.current.sandbox?.currentBranch).toBe('main');
  });

  it('returns null sandbox when 404', async () => {
    server.use(
      http.get(`${API_BASE}/api/clusters/:clusterId/sandbox`, () =>
        new HttpResponse(JSON.stringify({ error: 'Not found' }), { status: 404 })
      )
    );

    const { result } = renderHook(() => useSandbox('cluster-no-sandbox'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sandbox).toBeNull();
  });
});
