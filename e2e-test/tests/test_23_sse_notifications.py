"""E2E tests for SSE notification streaming."""

import os

import httpx

from helpers.api_client import BrainBookAPI

API_URL = os.environ.get("API_URL", "http://localhost:8080")


class TestSseNotificationStream:
    def test_sse_endpoint_returns_event_stream(self):
        """GET /api/notifications/stream should return text/event-stream content type."""
        with httpx.Client(base_url=API_URL, timeout=10) as client:
            with client.stream(
                "GET",
                "/api/notifications/stream",
                headers={"Accept": "text/event-stream"},
            ) as response:
                assert response.status_code == 200
                assert "text/event-stream" in response.headers.get("content-type", "")

    def test_sse_stream_sends_initial_unread_count(self):
        """SSE stream should send an initial unread-count event on connection."""
        with httpx.Client(base_url=API_URL, timeout=10) as client:
            with client.stream(
                "GET",
                "/api/notifications/stream",
                headers={"Accept": "text/event-stream"},
            ) as response:
                assert response.status_code == 200

                # Read lines until we get the initial event
                lines = []
                for line in response.iter_lines():
                    lines.append(line)
                    # SSE events end with an empty line after data
                    if line == "" and len(lines) > 1:
                        break
                    if len(lines) > 20:
                        break  # Safety limit

                event_block = "\n".join(lines)
                assert "unread-count" in event_block
                assert "count" in event_block

    def test_unread_count_endpoint_still_works(self, api: BrainBookAPI):
        """REST endpoint for unread count should still function alongside SSE."""
        count = api.get_unread_count()
        assert isinstance(count, int)
        assert count >= 0

    def test_mark_all_read_still_works(self, api: BrainBookAPI):
        """Mark all as read should function alongside SSE."""
        api.mark_all_notifications_read()
        count = api.get_unread_count()
        assert count == 0
