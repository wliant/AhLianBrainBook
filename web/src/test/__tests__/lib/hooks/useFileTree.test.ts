import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useFileTree } from '@/lib/hooks/useFileTree';
import { server } from '../../../mocks/server';
import { createWrapper } from '../../../utils/createWrapper';

const API_BASE = 'http://localhost:8080';

describe('useFileTree', () => {
  it('returns empty entries when clusterId is null', async () => {
    const { result } = renderHook(() => useFileTree(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toEqual([]);
  });

  it('fetches tree entries when clusterId is provided', async () => {
    const mockEntries = [
      { name: 'src', path: 'src', type: 'directory', size: null },
      { name: 'Main.java', path: 'src/Main.java', type: 'file', size: 1024 },
    ];
    server.use(
      http.get(`${API_BASE}/api/clusters/:clusterId/browse/tree`, () =>
        HttpResponse.json(mockEntries)
      )
    );

    const { result } = renderHook(() => useFileTree('cluster-1', 'main'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0].name).toBe('src');
    expect(result.current.entries[0].type).toBe('directory');
    expect(result.current.entries[1].name).toBe('Main.java');
    expect(result.current.entries[1].type).toBe('file');
  });
});
