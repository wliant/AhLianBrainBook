"""E2E tests for spaced repetition feature — API and browser."""

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate, navigate_to_neuron, open_sr_panel, unique_name


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


    def test_question_mode_defaults_to_mixed_and_round_trips(
        self, api: BrainBookAPI, neuron_in_cluster
    ):
        _, _, neuron = neuron_in_cluster
        try:
            item = api.add_sr_item(neuron["id"])
            assert item["questionMode"] == "MIXED"

            updated = api.set_sr_question_mode(item["id"], "CHOICE_ONLY")
            assert updated["questionMode"] == "CHOICE_ONLY"
            assert api.get_sr_item(neuron["id"])["questionMode"] == "CHOICE_ONLY"
        finally:
            api.remove_sr_item(neuron["id"])

    @pytest.mark.parametrize("count", [5, 10, 20, 50])
    def test_question_count_accepts_each_offered_value(
        self, api: BrainBookAPI, neuron_in_cluster, count
    ):
        _, _, neuron = neuron_in_cluster
        try:
            item = api.add_sr_item(neuron["id"])
            assert api.set_sr_question_count(item["id"], count)["questionCount"] == count
        finally:
            api.remove_sr_item(neuron["id"])

    def test_question_count_rejects_a_value_not_offered(
        self, api: BrainBookAPI, neuron_in_cluster
    ):
        _, _, neuron = neuron_in_cluster
        try:
            item = api.add_sr_item(neuron["id"])
            with pytest.raises(Exception):
                api.set_sr_question_count(item["id"], 7)
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

        expect(page.get_by_text("Now", exact=True)).to_be_visible(timeout=5000)

    def test_quiz_settings_offer_the_modes_and_counts(
        self, page: Page, api: BrainBookAPI, neuron_in_cluster
    ):
        brain, cluster, neuron = neuron_in_cluster
        api.add_sr_item(neuron["id"])
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
        open_sr_panel(page)

        mode_select = page.get_by_test_id("question-mode-select")
        expect(mode_select).to_be_visible(timeout=5000)
        assert mode_select.locator("option").all_inner_texts() == [
            "Free text only",
            "Mixed",
            "Multiple choice only",
        ]

        count_select = page.get_by_test_id("question-count-select")
        assert count_select.locator("option").all_inner_texts() == ["5", "10", "20", "50"]

    def test_quiz_settings_persist_across_a_reload(
        self, page: Page, api: BrainBookAPI, neuron_in_cluster
    ):
        brain, cluster, neuron = neuron_in_cluster
        item = api.add_sr_item(neuron["id"])
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
        open_sr_panel(page)

        page.get_by_test_id("question-mode-select").select_option("CHOICE_ONLY")
        expect(
            page.get_by_text("Every question is single- or multi-select", exact=False)
        ).to_be_visible(timeout=5000)
        page.get_by_test_id("question-count-select").select_option("20")

        # The backend is the source of truth, so confirm there before reloading.
        # Both selects PATCH independently, so poll rather than assume one deadline.
        stored = None
        for _ in range(20):
            stored = api.get_sr_item(neuron["id"])
            if stored["questionMode"] == "CHOICE_ONLY" and stored["questionCount"] == 20:
                break
            page.wait_for_timeout(500)
        assert stored["questionMode"] == "CHOICE_ONLY", stored
        assert stored["questionCount"] == 20, stored

        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
        open_sr_panel(page)
        expect(page.get_by_test_id("question-mode-select")).to_have_value(
            "CHOICE_ONLY", timeout=5000
        )
        expect(page.get_by_test_id("question-count-select")).to_have_value("20")

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


class TestReviewPageNeuronLink:
    """The review page must offer a way out to the neuron itself."""

    def test_api_exposes_brain_and_cluster_ids(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        try:
            item = api.add_sr_item(neuron["id"])
            assert item["brainId"] == brain["id"]
            assert item["clusterId"] == cluster["id"]
        finally:
            api.remove_sr_item(neuron["id"])

    def test_review_page_links_to_neuron_in_new_tab(
        self, page: Page, api: BrainBookAPI, neuron_in_cluster
    ):
        brain, cluster, neuron = neuron_in_cluster
        api.add_sr_item(neuron["id"])
        try:
            navigate(page, "/review")
            href = f"/brain/{brain['id']}/cluster/{cluster['id']}/neuron/{neuron['id']}"

            # Sidebar row carries an "open in new tab" link alongside the select button.
            row_link = page.locator(f'a[href="{href}"]').first
            expect(row_link).to_have_attribute("target", "_blank", timeout=10000)
        finally:
            api.remove_sr_item(neuron["id"])
