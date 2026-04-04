"""E2E tests for reminder title/description fields and global reminders endpoint."""

from datetime import datetime, timedelta, timezone

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate_to_neuron, unique_name


def future_iso(hours: int = 24) -> str:
    """Return an ISO timestamp in the future."""
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%S")


class TestReminderDescriptionAPI:
    def test_create_reminder_with_title_persists(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        title = unique_name("reminder-title")
        reminder = api.create_reminder(neuron["id"], future_iso(24), "ONCE", title=title)
        try:
            assert reminder["title"] == title
            assert reminder["neuronId"] == neuron["id"]
            # Verify it round-trips via the neuron-scoped list endpoint
            fetched = api.get_reminder(neuron["id"])
            assert fetched is not None
            assert fetched["title"] == title
        finally:
            api.delete_reminder(neuron["id"], reminder["id"])

    def test_create_reminder_with_description_persists(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        desc_json = '{"type":"doc","content":[]}'
        desc_text = "plain text content"
        reminder = api.create_reminder(
            neuron["id"],
            future_iso(24),
            "ONCE",
            description=desc_json,
            descriptionText=desc_text,
        )
        try:
            assert reminder["description"] == desc_json
            assert reminder["descriptionText"] == desc_text
        finally:
            api.delete_reminder(neuron["id"], reminder["id"])

    def test_global_reminders_list_includes_reminder(self, api: BrainBookAPI, neuron_in_cluster):
        """GET /api/reminders returns the created reminder with neuronTitle populated."""
        brain, cluster, neuron = neuron_in_cluster
        title = unique_name("global-list")
        reminder = api.create_reminder(neuron["id"], future_iso(24), "ONCE", title=title)
        try:
            all_reminders = api.list_all_reminders()
            found = next((r for r in all_reminders if r["id"] == reminder["id"]), None)

            assert found is not None, "Created reminder must appear in global list"
            assert found["title"] == title
            assert found["neuronId"] == neuron["id"]
            assert found["neuronTitle"] is not None, "neuronTitle must be populated in global list"
            assert found["isActive"] is True
        finally:
            api.delete_reminder(neuron["id"], reminder["id"])

    def test_global_reminders_list_ordered_by_trigger_at(self, api: BrainBookAPI, neuron_in_cluster):
        """GET /api/reminders returns reminders ordered by triggerAt ascending."""
        brain, cluster, neuron = neuron_in_cluster
        reminder_later = api.create_reminder(neuron["id"], future_iso(72), "ONCE")
        reminder_sooner = api.create_reminder(neuron["id"], future_iso(24), "ONCE")
        try:
            all_reminders = api.list_all_reminders()
            ids = [r["id"] for r in all_reminders]
            assert ids.index(reminder_sooner["id"]) < ids.index(reminder_later["id"]), \
                "Sooner reminder must come before later reminder in global list"
        finally:
            api.delete_reminder(neuron["id"], reminder_later["id"])
            api.delete_reminder(neuron["id"], reminder_sooner["id"])

    def test_update_reminder_title_and_description(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        reminder = api.create_reminder(neuron["id"], future_iso(24), "ONCE", title="original")
        try:
            new_desc = '{"type":"doc","content":[{"type":"paragraph"}]}'
            updated = api.update_reminder(
                neuron["id"],
                reminder["id"],
                reminderType="ONCE",
                triggerAt=future_iso(48),
                title="updated title",
                description=new_desc,
                descriptionText="paragraph",
            )
            assert updated["title"] == "updated title"
            assert updated["description"] == new_desc
            assert updated["descriptionText"] == "paragraph"
        finally:
            api.delete_reminder(neuron["id"], reminder["id"])


class TestReminderDescriptionBrowser:
    def test_reminder_title_input_visible_in_panel(self, neuron_on_page):
        """The title field appears inside the reminder form on the neuron page."""
        pg, brain, cluster, neuron = neuron_on_page
        pg.get_by_test_id("toggle-reminder").click()
        expect(pg.get_by_test_id("reminder-panel")).to_be_visible(timeout=5000)
        pg.get_by_test_id("new-reminder-btn").click()
        expect(pg.get_by_test_id("reminder-form")).to_be_visible(timeout=5000)

        # Title input must be present in the form
        title_input = pg.get_by_test_id("reminder-form").locator("input[type='text']")
        expect(title_input).to_be_visible(timeout=3000)

    def test_sidebar_reminders_section_shows_after_creating_reminder(
        self, page: Page, api: BrainBookAPI, neuron_in_cluster
    ):
        """After creating a reminder via API, the sidebar reminders section shows it."""
        brain, cluster, neuron = neuron_in_cluster
        title = unique_name("sidebar-reminder")
        reminder = api.create_reminder(
            neuron["id"], future_iso(24), "ONCE", title=title
        )
        try:
            navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
            # The sidebar reminders section should show the count badge (≥1)
            reminders_btn = page.locator("button", has_text="Reminders")
            expect(reminders_btn).to_be_visible(timeout=5000)
            # The reminder title should appear in the expanded list
            expect(page.get_by_text(title)).to_be_visible(timeout=5000)
        finally:
            api.delete_reminder(neuron["id"], reminder["id"])
