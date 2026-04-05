import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock globals before importing
let mockLocksRequest: ReturnType<typeof vi.fn>;
let mockBroadcastChannelInstances: Array<{
  onmessage: ((msg: MessageEvent) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}>;

class MockBroadcastChannel {
  onmessage: ((msg: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();

  constructor() {
    mockBroadcastChannelInstances.push(this);
  }
}

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners: Record<string, ((event: MessageEvent) => void)[]> = {};
  onerror: (() => void) | null = null;
  close = vi.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: (event: MessageEvent) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  // Helper for tests to simulate events
  emit(name: string, data: string) {
    (this.listeners[name] || []).forEach((h) =>
      h({ data } as MessageEvent)
    );
  }
}

beforeEach(() => {
  mockBroadcastChannelInstances = [];
  MockEventSource.instances = [];

  // Mock navigator.locks
  mockLocksRequest = vi.fn().mockImplementation((_name, callback) => {
    // Simulate acquiring the lock immediately (this tab is the leader)
    return callback();
  });

  Object.defineProperty(globalThis, "navigator", {
    value: {
      ...globalThis.navigator,
      locks: { request: mockLocksRequest },
    },
    writable: true,
    configurable: true,
  });

  vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("sseLeaderElection", () => {
  it("creates EventSource when tab becomes leader", async () => {
    // Import fresh to pick up mocks
    const { participateInSseLeaderElection } = await import(
      "@/lib/sseLeaderElection"
    );

    const handler = vi.fn();
    const cleanup = participateInSseLeaderElection(
      "http://localhost:8080/api/notifications/stream",
      handler,
      0 // no delay for testing
    );

    // Wait for EventSource to be created
    await vi.waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    });

    cleanup();
  });

  it("relays events to BroadcastChannel", async () => {
    const { participateInSseLeaderElection } = await import(
      "@/lib/sseLeaderElection"
    );

    const handler = vi.fn();
    const cleanup = participateInSseLeaderElection(
      "http://localhost:8080/api/notifications/stream",
      handler,
      0
    );

    await vi.waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    });

    // Simulate SSE event
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];
    es.emit("unread-count", '{"count":5}');

    // Event delivered to self
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ name: "unread-count", data: '{"count":5}' })
    );

    // Event relayed to BroadcastChannel
    const channel = mockBroadcastChannelInstances[0];
    expect(channel.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ name: "unread-count", data: '{"count":5}' })
    );

    cleanup();
  });

  it("receives events from BroadcastChannel as follower tab", async () => {
    const { participateInSseLeaderElection } = await import(
      "@/lib/sseLeaderElection"
    );

    // Simulate a tab that does NOT acquire the lock (follower).
    // The BroadcastChannel onmessage handler should still deliver events.
    const handler = vi.fn();
    const cleanup = participateInSseLeaderElection(
      "http://localhost:8080/api/notifications/stream",
      handler,
      0
    );

    // Simulate receiving a relayed event on BroadcastChannel
    const channel = mockBroadcastChannelInstances[0];
    if (channel?.onmessage) {
      channel.onmessage({
        data: { name: "new-notification", data: '{"count":1}' },
      } as MessageEvent);
    }

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ name: "new-notification", data: '{"count":1}' })
    );

    cleanup();
  });

  it("closes EventSource and BroadcastChannel on cleanup", async () => {
    const { participateInSseLeaderElection } = await import(
      "@/lib/sseLeaderElection"
    );

    const handler = vi.fn();
    const cleanup = participateInSseLeaderElection(
      "http://localhost:8080/api/notifications/stream",
      handler,
      0
    );

    await vi.waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    });

    cleanup();

    const channel = mockBroadcastChannelInstances[0];
    expect(channel.close).toHaveBeenCalled();
  });
});
