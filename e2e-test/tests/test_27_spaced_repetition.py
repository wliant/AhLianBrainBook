"""E2E tests for spaced repetition feature — API and browser."""

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate_to_neuron, open_sr_panel, unique_name


class TestSpacedRepetitionAPI:
    """API-level tests for spaced repetition endpoints."""

    def test_add_item(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        try:
            item = api.add_sr_item(neuron["id"])
            assert item["neuronId"] == neuron["id"]
            assert item["easeFactor"] == 2.5
            assert item["intervalDays"] == 0
            assert item["repetitions"] == 0
            assert item["nextReviewAt"] is not None
            assert item["lastReviewedAt"] is None
        finally:
            api.remove_sr_item(neuron["id"])

    def test_add_item_idempotent(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        try:
            first = api.add_sr_item(neuron["id"])
            second = api.add_sr_item(neuron["id"])
            assert first["id"] == second["id"]
        finally:
            api.remove_sr_item(neuron["id"])

    def test_get_item(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        try:
            added = api.add_sr_item(neuron["id"])
            fetched = api.get_sr_item(neuron["id"])
            assert fetched is not None
            assert fetched["id"] == added["id"]
            assert fetched["neuronId"] == neuron["id"]
        finally:
            api.remove_sr_item(neuron["id"])

    def test_get_item_not_found(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        result = api.get_sr_item(neuron["id"])
        assert result is None

    def test_remove_item(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        api.add_sr_item(neuron["id"])
        api.remove_sr_item(neuron["id"])
        assert api.get_sr_item(neuron["id"]) is None

    def test_get_all_items(self, api: BrainBookAPI, two_neurons_in_cluster):
        _, _, neuron_a, neuron_b = two_neurons_in_cluster
        try:
            api.add_sr_item(neuron_a["id"])
            api.add_sr_item(neuron_b["id"])
            items = api.get_all_sr_items()
            neuron_ids = [i["neuronId"] for i in items]
            assert neuron_a["id"] in neuron_ids
            assert neuron_b["id"] in neuron_ids
        finally:
            api.remove_sr_item(neuron_a["id"])
            api.remove_sr_item(neuron_b["id"])

    def test_get_queue_includes_due_items(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        try:
            api.add_sr_item(neuron["id"])
            queue = api.get_sr_queue()
            neuron_ids = [i["neuronId"] for i in queue]
            assert neuron["id"] in neuron_ids
        finally:
            api.remove_sr_item(neuron["id"])

    def test_submit_review(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        try:
            item = api.add_sr_item(neuron["id"])
            reviewed = api.submit_sr_review(item["id"], 4)
            assert reviewed["repetitions"] == 1
            assert reviewed["intervalDays"] == 1
            assert reviewed["lastReviewedAt"] is not None
        finally:
            api.remove_sr_item(neuron["id"])

    def test_submit_review_pushes_out_of_queue(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        try:
            item = api.add_sr_item(neuron["id"])
            api.submit_sr_review(item["id"], 5)
            queue = api.get_sr_queue()
            neuron_ids = [i["neuronId"] for i in queue]
            assert neuron["id"] not in neuron_ids
        finally:
            api.remove_sr_item(neuron["id"])


class TestSpacedRepetitionBrowser:
    """Browser-level tests for the spaced repetition panel."""

    def test_sr_panel_opens(self, neuron_on_page):
        page, brain, cluster, neuron = neuron_on_page
        open_sr_panel(page)
        expect(page.get_by_text("not in your review queue")).to_be_visible(timeout=5000)

    def test_add_from_panel(self, neuron_on_page):
        page, brain, cluster, neuron = neuron_on_page
        open_sr_panel(page)

        expect(page.get_by_test_id("sr-add-btn")).to_be_visible(timeout=5000)
        page.get_by_test_id("sr-add-btn").click()

        expect(page.get_by_text("Next review")).to_be_visible(timeout=5000)
        expect(page.get_by_test_id("sr-remove-btn")).to_be_visible(timeout=5000)

    def test_remove_from_panel(self, page: Page, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        api.add_sr_item(neuron["id"])
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
        open_sr_panel(page)

        expect(page.get_by_text("Next review")).to_be_visible(timeout=5000)
        page.get_by_test_id("sr-remove-btn").click()

        expect(page.get_by_text("not in your review queue")).to_be_visible(timeout=5000)
        expect(page.get_by_test_id("sr-add-btn")).to_be_visible(timeout=5000)

    def test_sr_panel_shows_now_for_due_item(self, page: Page, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        api.add_sr_item(neuron["id"])
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
        open_sr_panel(page)

        expect(page.get_by_text("Now")).to_be_visible(timeout=5000)

    def test_sr_panel_mutual_exclusivity_with_history(self, neuron_on_page):
        page, brain, cluster, neuron = neuron_on_page
        open_sr_panel(page)
        expect(page.get_by_test_id("sr-panel")).to_be_visible()

        page.get_by_test_id("toggle-history").click()
        expect(page.get_by_test_id("history-panel")).to_be_visible(timeout=5000)
        expect(page.get_by_test_id("sr-panel")).not_to_be_visible()

    def test_sr_panel_mutual_exclusivity_with_reminder(self, neuron_on_page):
        page, brain, cluster, neuron = neuron_on_page
        open_sr_panel(page)
        expect(page.get_by_test_id("sr-panel")).to_be_visible()

        page.get_by_test_id("toggle-reminder").click()
        expect(page.get_by_test_id("reminder-panel")).to_be_visible(timeout=5000)
        expect(page.get_by_test_id("sr-panel")).not_to_be_visible()

    def test_sr_toggle_icon_highlights_when_in_review(self, page: Page, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        api.add_sr_item(neuron["id"])
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        sr_icon = page.locator('[data-testid="toggle-sr"] svg')
        expect(sr_icon).to_be_visible(timeout=5000)
        icon_class = sr_icon.get_attribute("class") or ""
        assert "fill-purple-400" in icon_class, f"Expected purple fill, got: {icon_class}"
