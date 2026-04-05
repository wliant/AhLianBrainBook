"""E2E tests for settings (GAP-003)."""

import os

import pytest
from helpers.api_client import BrainBookAPI
from helpers.page_helpers import unique_name

BASE_URL = os.environ.get("BASE_URL", "http://localhost:23000")


class TestSettingsAPI:
    """API-level settings tests."""

    def test_get_default_settings(self, api: BrainBookAPI):
        settings = api.get_settings()

        assert settings["displayName"] is not None
        assert settings["maxRemindersPerNeuron"] >= 1
        assert settings["timezone"] is not None

    def test_update_display_name(self, api: BrainBookAPI):
        original = api.get_settings()
        try:
            updated = api.update_settings(displayName="E2E Tester")
            assert updated["displayName"] == "E2E Tester"
        finally:
            api.update_settings(displayName=original["displayName"])

    def test_update_timezone(self, api: BrainBookAPI):
        original = api.get_settings()
        try:
            updated = api.update_settings(timezone="America/New_York")
            assert updated["timezone"] == "America/New_York"
        finally:
            api.update_settings(timezone=original["timezone"])

    def test_update_max_reminders(self, api: BrainBookAPI):
        original = api.get_settings()
        try:
            updated = api.update_settings(maxRemindersPerNeuron=5)
            assert updated["maxRemindersPerNeuron"] == 5
        finally:
            api.update_settings(maxRemindersPerNeuron=original["maxRemindersPerNeuron"])


@pytest.mark.browser
class TestSettingsBrowser:
    """Browser-level settings tests."""

    def test_settings_page_loads(self, page):
        page.goto(f"{BASE_URL}/settings")
        page.wait_for_load_state("networkidle")

        # Should see the settings heading or display name input
        assert page.get_by_text("Settings").first.is_visible() or \
               page.get_by_test_id("max-reminders-input").is_visible()

    def test_settings_displays_current_values(self, page, api: BrainBookAPI):
        settings = api.get_settings()
        page.goto(f"{BASE_URL}/settings")
        page.wait_for_load_state("networkidle")

        # The timezone dropdown should have the current timezone
        tz_select = page.get_by_test_id("timezone-select")
        if tz_select.is_visible():
            assert tz_select.input_value() == settings["timezone"]
