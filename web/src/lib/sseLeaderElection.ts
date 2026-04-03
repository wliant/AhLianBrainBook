/**
 * Cross-tab SSE leader election using navigator.locks + BroadcastChannel.
 *
 * Only the "leader" tab opens the EventSource connection.
 * All other tabs receive events via BroadcastChannel relay.
 * When the leader tab closes, the lock is released and another tab claims it.
 */

const SSE_LOCK_NAME = "brainbook-sse-leader";
const SSE_CHANNEL_NAME = "brainbook-sse";

export interface SseEvent {
  name: string;
  data: string;
}

export type SseEventHandler = (event: SseEvent) => void;

const isSupported =
  typeof navigator !== "undefined" &&
  "locks" in navigator &&
  typeof BroadcastChannel !== "undefined";

/**
 * Start participating in SSE leader election.
 * Returns a cleanup function to stop participation.
 */
export function participateInSseLeaderElection(
  sseUrl: string,
  onEvent: SseEventHandler,
  delayMs = 2000
): () => void {
  if (!isSupported) {
    // Fallback: direct SSE connection (original behavior)
    return startDirectConnection(sseUrl, onEvent, delayMs);
  }

  let destroyed = false;
  const channel = new BroadcastChannel(SSE_CHANNEL_NAME);

  // Listen for relayed events from the leader
  channel.onmessage = (msg: MessageEvent<SseEvent>) => {
    if (!destroyed) {
      onEvent(msg.data);
    }
  };

  // Attempt to acquire leader lock
  // navigator.locks.request is a promise that resolves when the lock is released.
  // The callback runs while we hold the lock. When the callback's promise resolves,
  // the lock is released. We keep it held by never resolving until cleanup.
  let releaseLock: (() => void) | null = null;

  navigator.locks.request(SSE_LOCK_NAME, () => {
    if (destroyed) return Promise.resolve();

    // We are the leader — open the SSE connection
    return new Promise<void>((resolve) => {
      releaseLock = resolve;

      const timer = setTimeout(() => {
        if (destroyed) {
          resolve();
          return;
        }

        const es = new EventSource(sseUrl);

        const relay = (eventName: string) => (event: MessageEvent) => {
          const sseEvent: SseEvent = { name: eventName, data: event.data };
          // Deliver to self
          onEvent(sseEvent);
          // Relay to other tabs
          try {
            channel.postMessage(sseEvent);
          } catch {
            // Channel may be closed
          }
        };

        es.addEventListener("unread-count", relay("unread-count"));
        es.addEventListener("new-notification", relay("new-notification"));

        es.onerror = () => {
          // EventSource auto-reconnects on error
        };

        // Store cleanup for when we release the lock
        const originalRelease = releaseLock;
        releaseLock = () => {
          es.close();
          originalRelease?.();
        };
      }, delayMs);

      // If destroyed before timer fires, clean up
      const checkDestroyed = setInterval(() => {
        if (destroyed) {
          clearTimeout(timer);
          clearInterval(checkDestroyed);
          resolve();
        }
      }, 100);
    });
  });

  return () => {
    destroyed = true;
    channel.close();
    if (releaseLock) releaseLock();
  };
}

/** Fallback: direct SSE connection without leader election */
function startDirectConnection(
  sseUrl: string,
  onEvent: SseEventHandler,
  delayMs: number
): () => void {
  let es: EventSource | null = null;

  const timer = setTimeout(() => {
    es = new EventSource(sseUrl);

    es.addEventListener("unread-count", (event) => {
      onEvent({ name: "unread-count", data: (event as MessageEvent).data });
    });

    es.addEventListener("new-notification", (event) => {
      onEvent({ name: "new-notification", data: (event as MessageEvent).data });
    });

    es.onerror = () => {
      // EventSource auto-reconnects
    };
  }, delayMs);

  return () => {
    clearTimeout(timer);
    if (es) {
      es.close();
      es = null;
    }
  };
}
