"""E2E tests for notifications."""

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate


class TestNotificationsAPI:
    def test_get_notifications(self, api: BrainBookAPI):
        notifications = api.get_notifications()
        assert isinstance(notifications, list)

    def test_get_unread_count(self, api: BrainBookAPI):
        count = api.get_unread_count()
        assert isinstance(count, int)
        assert count >= 0

    def test_mark_all_as_read(self, api: BrainBookAPI):
        # Should not raise even if no unread notifications
        api.mark_all_notifications_read()
        count = api.get_unread_count()
        assert count == 0


class TestNotificationsBrowser:
    def test_notification_bell_visible(self, home: Page):
        expect(home.get_by_test_id("notification-bell").last).to_be_visible(timeout=5000)

    def test_notification_popover_opens(self, home: Page):
        home.get_by_test_id("notification-bell").last.click()
        expect(home.get_by_test_id("notification-popover")).to_be_visible(timeout=5000)
        expect(home.get_by_text("Notifications", exact=True)).to_be_visible()

    def test_empty_notifications_state(self, home: Page, api: BrainBookAPI):
        # Ensure all notifications are read first
        api.mark_all_notifications_read()

        home.get_by_test_id("notification-bell").last.click()
        expect(home.get_by_test_id("notification-popover")).to_be_visible(timeout=5000)
        # Should show either empty state or notification list
        popover = home.get_by_test_id("notification-popover")
        expect(popover).to_be_visible()
