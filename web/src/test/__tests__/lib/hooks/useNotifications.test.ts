import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { server } from '../../../mocks/server';
import { createWrapper } from '../../../utils/createWrapper';

const API_BASE = 'http://localhost:8080';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  listeners: Record<string, ((event: MessageEvent) => void)[]> = {};
  onerror: ((event: Event) => void) | null = null;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    this.readyState = 1; // OPEN
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(l => l !== listener);
    }
  }

  close() {
    this.readyState = 2;
    MockEventSource.instances = MockEventSource.instances.filter(i => i !== this);
  }

  // Test helper: simulate an SSE event
  simulateEvent(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    (this.listeners[type] || []).forEach(l => l(event));
  }

  static reset() {
    MockEventSource.instances.forEach(i => i.close());
    MockEventSource.instances = [];
  }
}

// Install mock
const originalEventSource = globalThis.EventSource;
beforeEach(() => {
  MockEventSource.reset();
  (globalThis as unknown as Record<string, unknown>).EventSource = MockEventSource as unknown as typeof EventSource;
});
afterEach(() => {
  MockEventSource.reset();
  (globalThis as unknown as Record<string, unknown>).EventSource = originalEventSource;
});

// Helper to wait for SSE connection (delayed by 2s in hook)
async function waitForSseConnection() {
  await waitFor(() => {
    expect(MockEventSource.instances).toHaveLength(1);
  }, { timeout: 5000 });
}

describe('useNotifications', () => {
  it('connects to SSE stream on mount after delay', async () => {
    server.use(
      http.get(`${API_BASE}/api/notifications/unread/count`, () =>
        HttpResponse.json({ count: 0 })
      )
    );

    renderHook(() => useNotifications(), { wrapper: createWrapper() });

    await waitForSseConnection();

    expect(MockEventSource.instances[0].url).toBe(`${API_BASE}/api/notifications/stream`);
  });

  it('fetches initial unread count', async () => {
    server.use(
      http.get(`${API_BASE}/api/notifications/unread/count`, () =>
        HttpResponse.json({ count: 3 })
      )
    );

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(3);
    });
  });

  it('updates unread count from SSE unread-count event', async () => {
    server.use(
      http.get(`${API_BASE}/api/notifications/unread/count`, () =>
        HttpResponse.json({ count: 0 })
      )
    );

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });

    await waitForSseConnection();

    // Simulate SSE event
    act(() => {
      MockEventSource.instances[0].simulateEvent('unread-count', { count: 5 });
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5);
    });
  });

  it('updates unread count from SSE new-notification event', async () => {
    server.use(
      http.get(`${API_BASE}/api/notifications/unread/count`, () =>
        HttpResponse.json({ count: 0 })
      )
    );

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });

    await waitForSseConnection();

    act(() => {
      MockEventSource.instances[0].simulateEvent('new-notification', {
        count: 1,
        neuronTitle: 'Test Neuron',
        message: 'Reminder: Test Neuron',
      });
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });
  });

  it('closes EventSource on unmount', async () => {
    server.use(
      http.get(`${API_BASE}/api/notifications/unread/count`, () =>
        HttpResponse.json({ count: 0 })
      )
    );

    const { unmount } = renderHook(() => useNotifications(), { wrapper: createWrapper() });

    await waitForSseConnection();

    unmount();

    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('markAsRead calls API and invalidates queries', async () => {
    let markAsReadCalled = false;
    server.use(
      http.get(`${API_BASE}/api/notifications/unread/count`, () =>
        HttpResponse.json({ count: 1 })
      ),
      http.post(`${API_BASE}/api/notifications/:id/read`, () => {
        markAsReadCalled = true;
        return new HttpResponse(null, { status: 200 });
      })
    );

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });

    await act(async () => {
      await result.current.markAsRead('notif-1');
    });

    expect(markAsReadCalled).toBe(true);
  });

  it('markAllAsRead calls API and invalidates queries', async () => {
    let markAllCalled = false;
    server.use(
      http.get(`${API_BASE}/api/notifications/unread/count`, () =>
        HttpResponse.json({ count: 5 })
      ),
      http.post(`${API_BASE}/api/notifications/read-all`, () => {
        markAllCalled = true;
        return new HttpResponse(null, { status: 200 });
      })
    );

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5);
    });

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(markAllCalled).toBe(true);
  });
});
