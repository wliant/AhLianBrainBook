import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { api } from '@/lib/api';
import { server } from '../../mocks/server';

const API_BASE = 'http://localhost:8080';

describe('api', () => {
  it('get fetches data', async () => {
    const mockBrains = [
      {
        id: 'brain-1',
        name: 'Test Brain',
        icon: null,
        color: null,
        sortOrder: 0,
        isArchived: false,
        createdAt: '2024-01-01T00:00:00',
        updatedAt: '2024-01-01T00:00:00',
      },
    ];
    server.use(
      http.get(`${API_BASE}/api/brains`, () => HttpResponse.json(mockBrains))
    );

    const result = await api.get('/api/brains');
    expect(result).toEqual(mockBrains);
  });

  it('post sends body', async () => {
    let receivedBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/api/brains`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: 'brain-1', ...receivedBody },
          { status: 201 }
        );
      })
    );

    await api.post('/api/brains', { name: 'New Brain', icon: null, color: null });
    expect(receivedBody).toEqual({ name: 'New Brain', icon: null, color: null });
  });

  it('throws on error response', async () => {
    server.use(
      http.get(`${API_BASE}/api/brains/nonexistent`, () =>
        HttpResponse.json({ message: 'Not found' }, { status: 404 })
      )
    );

    await expect(api.get('/api/brains/nonexistent')).rejects.toThrow('Not found');
  });

  it('returns undefined for 204', async () => {
    server.use(
      http.delete(`${API_BASE}/api/brains/brain-1`, () =>
        new HttpResponse(null, { status: 204 })
      )
    );

    const result = await api.delete('/api/brains/brain-1');
    expect(result).toBeUndefined();
  });
});
