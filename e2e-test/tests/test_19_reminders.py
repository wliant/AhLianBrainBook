"""E2E tests for reminders."""

from datetime import datetime, timedelta, timezone

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate_to_neuron, unique_name


def future_iso(hours: int = 24) -> str:
    """Return an ISO timestamp in the future."""
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%S")


class TestRemindersAPI:
    def test_create_reminder(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        trigger = future_iso(24)
        reminder = api.create_reminder(neuron["id"], trigger, "ONCE")
        try:
            assert reminder["reminderType"] == "ONCE"
            assert reminder["neuronId"] == neuron["id"]
        finally:
            api.delete_reminder(neuron["id"], reminder["id"])

    def test_get_reminder(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        trigger = future_iso(48)
        reminder = api.create_reminder(neuron["id"], trigger, "ONCE")
        try:
            fetched = api.get_reminder(neuron["id"])
            assert fetched is not None
            assert fetched["neuronId"] == neuron["id"]
        finally:
            api.delete_reminder(neuron["id"], reminder["id"])

    def test_update_reminder(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        trigger = future_iso(24)
        reminder = api.create_reminder(neuron["id"], trigger, "ONCE")
        try:
            new_trigger = future_iso(72)
            updated = api.update_reminder(
                neuron["id"],
                reminder["id"],
                reminderType="RECURRING",
                triggerAt=new_trigger,
                recurrencePattern="DAILY",
                recurrenceInterval=1,
            )
            assert updated["reminderType"] == "RECURRING"
        finally:
            api.delete_reminder(neuron["id"], reminder["id"])

    def test_delete_reminder(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        trigger = future_iso(24)
        reminder = api.create_reminder(neuron["id"], trigger, "ONCE")
        api.delete_reminder(neuron["id"], reminder["id"])
        fetched = api.get_reminder(neuron["id"])
        assert fetched is None

    def test_no_reminder_returns_none(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        fetched = api.get_reminder(neuron["id"])
        assert fetched is None


class TestRemindersBrowser:
    def test_reminder_dialog_opens(self, neuron_on_page):
        pg, brain, cluster, neuron = neuron_on_page
        pg.get_by_test_id("toggle-reminder").click()
        expect(pg.get_by_test_id("reminder-panel")).to_be_visible(timeout=5000)
        pg.get_by_test_id("new-reminder-btn").click()
        expect(pg.get_by_test_id("reminder-form")).to_be_visible(timeout=5000)
        expect(pg.get_by_test_id("reminder-type-once")).to_be_visible(timeout=5000)
        expect(pg.get_by_test_id("reminder-type-recurring")).to_be_visible(timeout=5000)

    def test_reminder_dialog_save_disabled_without_time(self, neuron_on_page):
        pg, brain, cluster, neuron = neuron_on_page
        pg.get_by_test_id("toggle-reminder").click()
        expect(pg.get_by_test_id("reminder-panel")).to_be_visible(timeout=5000)
        pg.get_by_test_id("new-reminder-btn").click()
        expect(pg.get_by_test_id("reminder-form")).to_be_visible(timeout=5000)

        save_btn = pg.get_by_test_id("reminder-save-btn")
        expect(save_btn).to_be_disabled()

    def test_existing_reminder_shows_delete_button(self, page: Page, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        trigger = future_iso(24)
        reminder = api.create_reminder(neuron["id"], trigger, "ONCE")
        try:
            navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
            page.get_by_test_id("toggle-reminder").click()
            expect(page.get_by_test_id("reminder-panel")).to_be_visible(timeout=5000)
            # Each reminder item has a delete button inside it
            reminder_item = page.get_by_test_id(f"reminder-{reminder['id']}")
            expect(reminder_item).to_be_visible(timeout=5000)
            expect(reminder_item.locator("button[title='Delete']")).to_be_visible()
        finally:
            api.delete_reminder(neuron["id"], reminder["id"])
