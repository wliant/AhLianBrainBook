"""E2E tests for revision workflow via UI."""

import json

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate_to_neuron, open_history_panel, unique_name


class TestRevisionWorkflowBrowser:
    def test_history_panel_opens(self, neuron_on_page):
        pg, brain, cluster, neuron = neuron_on_page
        open_history_panel(pg)
        expect(pg.get_by_role("heading", name="History")).to_be_visible(timeout=5000)
        expect(pg.get_by_test_id("create-snapshot-btn")).to_be_visible(timeout=5000)

    def test_create_snapshot_via_ui(self, api: BrainBookAPI, neuron_on_page):
        pg, brain, cluster, neuron = neuron_on_page
        open_history_panel(pg)

        pg.get_by_test_id("create-snapshot-btn").click()
        # After creating snapshot, a revision item should appear
        expect(pg.get_by_text("#1")).to_be_visible(timeout=5000)

    def test_view_revision_shows_banner(self, page: Page, api: BrainBookAPI, neuron_with_content):
        brain, cluster, neuron = neuron_with_content
        # Create a snapshot via API
        snapshot = api.create_snapshot(neuron["id"])

        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
        open_history_panel(page)

        # Click view on the revision
        view_btn = page.get_by_test_id(f"view-revision-{snapshot['id']}")
        expect(view_btn).to_be_visible(timeout=5000)
        view_btn.click()

        # Revision banner should appear
        expect(page.get_by_test_id("revision-banner")).to_be_visible(timeout=5000)
        expect(page.get_by_text("Viewing revision")).to_be_visible(timeout=5000)

    def test_dismiss_revision_banner(self, page: Page, api: BrainBookAPI, neuron_with_content):
        brain, cluster, neuron = neuron_with_content
        snapshot = api.create_snapshot(neuron["id"])

        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
        open_history_panel(page)

        page.get_by_test_id(f"view-revision-{snapshot['id']}").click()
        expect(page.get_by_test_id("revision-banner")).to_be_visible(timeout=5000)

        page.get_by_test_id("revision-banner").click()
        expect(page.get_by_test_id("revision-banner")).not_to_be_visible(timeout=3000)

    def test_restore_revision_via_ui(self, page: Page, api: BrainBookAPI, neuron_with_content):
        brain, cluster, neuron = neuron_with_content
        snapshot = api.create_snapshot(neuron["id"])

        # Update content to something different
        new_content = json.dumps({"version": 2, "sections": [{"id": "s1", "type": "rich-text", "content": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Changed after snapshot"}]}]}}]})
        api.update_neuron_content(neuron["id"], new_content, "Changed after snapshot", neuron["version"] + 1)

        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
        open_history_panel(page)

        # Click restore
        restore_btn = page.get_by_test_id(f"restore-revision-{snapshot['id']}")
        expect(restore_btn).to_be_visible(timeout=5000)
        restore_btn.click()

        # Confirm dialog appears
        expect(page.get_by_test_id("confirm-restore-dialog")).to_be_visible(timeout=5000)
        page.get_by_role("button", name="Restore").click()

        # Dialog should close
        expect(page.get_by_test_id("confirm-restore-dialog")).not_to_be_visible(timeout=5000)
