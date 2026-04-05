# DEF-001: SSE Connection Exhaustion on Multiple Tabs

## Status
Closed

## Severity
High

## Summary
Opening multiple browser tabs of BrainBook causes the application to stop working. Each tab opens its own SSE connection to `/api/notifications/stream`, exhausting the server's available threads/connections.

## Steps to Reproduce
1. Open BrainBook in a browser tab
2. Open the same app in 2-3 additional tabs
3. Observe that the app becomes unresponsive; console shows `ERR_CONNECTION_REFUSED` on the notification stream endpoint

## Expected Behavior
Multiple tabs should share a single notification stream without exhausting server resources.

## Actual Behavior
Each tab creates its own SSE connection. The server runs out of available connections, causing all tabs (and the API) to become unresponsive.

## Root Cause
The `NotificationStream` SSE endpoint holds a long-lived HTTP connection per tab. Tomcat's default thread pool is limited, and SSE connections consume one thread each.

## Proposed Fix
Replace the per-tab SSE connection with the **Broadcast Channel API**:

1. Designate one tab as the "leader" that maintains the single SSE connection
2. The leader tab broadcasts received events to all other tabs via `BroadcastChannel`
3. If the leader tab closes, another tab takes over the SSE connection (leader election)
4. Fallback: if `BroadcastChannel` is not supported, each tab polls instead of using SSE

### Implementation Notes
- Use a `BroadcastChannel('brainbook-notifications')` shared across tabs
- Leader election can use `navigator.locks.request()` or a simple localStorage-based approach
- The SSE hook (`useNotifications` or equivalent) should detect if another tab already holds the connection

## Affected Components
- **Frontend**: SSE subscription hook
- **Backend**: `/api/notifications/stream` endpoint (no changes needed if frontend is fixed)
