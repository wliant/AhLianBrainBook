"""E2E tests for Neuron CRUD operations via browser."""

import json
import os
import re

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate, navigate_to_neuron, navigate_to_cluster, wait_for_save, unique_name


class TestNeuronCreateViaBrowser:
    def test_create_neuron_from_cluster_page(self, home: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        page = home
        navigate_to_cluster(page, brain["id"], cluster["id"])

        # Empty state should show
        expect(page.get_by_text("No neurons yet")).to_be_visible()

        page.get_by_test_id("new-neuron-btn").click()
        page.wait_for_load_state("networkidle")

        # Should navigate to editor page
        expect(page).to_have_url(re.compile(r".*/neuron/.*"), timeout=5000)

        # Title input should be visible with placeholder
        expect(page.get_by_test_id("neuron-title-input")).to_be_visible(timeout=5000)

    def test_new_neuron_appears_in_cluster_list(self, home: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron(unique_name("Listed Neuron"), brain["id"], cluster["id"])

        page = home
        navigate_to_cluster(page, brain["id"], cluster["id"])

        expect(page.get_by_text(neuron["title"])).to_be_visible(timeout=5000)

        api.permanent_delete_neuron(neuron["id"])


class TestNeuronEditorViaBrowser:
    def test_edit_title(self, home: Page, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        page = home
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        title_input = page.get_by_test_id("neuron-title-input")
        title_input.clear()
        title_input.fill("Updated Title")

        # Wait for auto-save using the Saved indicator
        wait_for_save(page)

        updated = api.get_neuron(neuron["id"])
        assert updated["title"] == "Updated Title"

    def test_edit_content_autosaves(self, home: Page, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        page = home
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        editor = page.locator(".ProseMirror")
        editor.click()
        editor.type("Hello E2E Test Content")

        # Wait for debounced save using the Saved indicator
        wait_for_save(page)

        updated = api.get_neuron(neuron["id"])
        assert "Hello E2E Test Content" in (updated.get("contentText") or "")

    def test_save_status_indicator_shows_saved(self, home: Page, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        page = home
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        editor = page.locator(".ProseMirror")
        editor.click()
        editor.type("Trigger save")

        wait_for_save(page)


class TestNeuronFavoriteViaBrowser:
    def test_toggle_favorite(self, home: Page, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        page = home
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        page.get_by_test_id("toggle-favorite").click()
        # Wait for the API call to complete by checking server state
        expect(page.get_by_test_id("toggle-favorite")).to_be_visible()
        page.wait_for_timeout(300)  # minimal wait for API round-trip

        updated = api.get_neuron(neuron["id"])
        assert updated["isFavorite"] is True

        page.get_by_test_id("toggle-favorite").click()
        page.wait_for_timeout(300)

        updated = api.get_neuron(neuron["id"])
        assert updated["isFavorite"] is False


class TestNeuronPinViaBrowser:
    def test_toggle_pin(self, home: Page, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        page = home
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        page.get_by_test_id("toggle-pin").click()
        page.wait_for_timeout(300)

        updated = api.get_neuron(neuron["id"])
        assert updated["isPinned"] is True

        page.get_by_test_id("toggle-pin").click()
        page.wait_for_timeout(300)

        updated = api.get_neuron(neuron["id"])
        assert updated["isPinned"] is False


class TestNeuronClickThrough:
    def test_neuron_click_through_to_editor(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron(unique_name("Click Through Neuron"), brain["id"], cluster["id"])

        # Verify link exists on cluster page
        navigate_to_cluster(page, brain["id"], cluster["id"])
        link = page.locator(f"a[href*='/neuron/{neuron['id']}']")
        expect(link).to_be_visible()

        # Navigate directly to editor
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
        expect(page.get_by_test_id("neuron-title-input")).to_have_value(neuron["title"])

        api.permanent_delete_neuron(neuron["id"])


class TestNeuronAPIOperations:
    def test_optimistic_locking_conflict(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster

        r1 = api.update_neuron_content_raw(neuron["id"], '{"type":"doc"}', "content v1", neuron["version"])
        assert r1.status_code == 200

        r2 = api.update_neuron_content_raw(neuron["id"], '{"type":"doc"}', "content v2", neuron["version"])
        assert r2.status_code == 409

    def test_duplicate_neuron(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        dup = api.duplicate_neuron(neuron["id"])

        assert dup["title"] == neuron["title"] + " (copy)"
        assert dup["version"] == 1
        assert dup["id"] != neuron["id"]

        api.permanent_delete_neuron(dup["id"])

    def test_move_neuron(self, api: BrainBookAPI):
        brain_a = api.create_brain(unique_name("Neuron Move A"))
        brain_b = api.create_brain(unique_name("Neuron Move B"))
        cluster_a = api.create_cluster(unique_name("Cluster A"), brain_a["id"])
        cluster_b = api.create_cluster(unique_name("Cluster B"), brain_b["id"])
        neuron = api.create_neuron(unique_name("Movable"), brain_a["id"], cluster_a["id"])

        try:
            api.move_neuron(neuron["id"], brain_b["id"], cluster_b["id"])

            # Verify by fetching the neuron directly
            moved = api.get_neuron(neuron["id"])
            assert moved["brainId"] == brain_b["id"]
            assert moved["clusterId"] == cluster_b["id"]

            neurons_a = api.list_neurons(cluster_a["id"])
            neurons_b = api.list_neurons(cluster_b["id"])
            assert not any(n["id"] == neuron["id"] for n in neurons_a)
            assert any(n["id"] == neuron["id"] for n in neurons_b)
        finally:
            api.permanent_delete_neuron(neuron["id"])
            api.delete_cluster(cluster_a["id"])
            api.delete_cluster(cluster_b["id"])
            api.delete_brain(brain_a["id"])
            api.delete_brain(brain_b["id"])

    def test_soft_delete_and_restore_from_trash(self, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron("Trashable", brain["id"], cluster["id"])

        api.delete_neuron(neuron["id"])

        neurons = api.list_neurons(cluster["id"])
        assert not any(n["id"] == neuron["id"] for n in neurons)

        trash = api.get_trash()
        assert any(n["id"] == neuron["id"] for n in trash)

        restored = api.restore_from_trash(neuron["id"])
        assert restored["isDeleted"] is False

        neurons = api.list_neurons(cluster["id"])
        assert any(n["id"] == neuron["id"] for n in neurons)

        api.permanent_delete_neuron(neuron["id"])

    def test_permanent_delete(self, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron("Permanent Delete", brain["id"], cluster["id"])

        api.delete_neuron(neuron["id"])
        api.permanent_delete_neuron(neuron["id"])

        trash = api.get_trash()
        assert not any(n["id"] == neuron["id"] for n in trash)

    def test_archive_and_restore_neuron(self, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron("Archivable", brain["id"], cluster["id"])

        archived = api.archive_neuron(neuron["id"])
        assert archived["isArchived"] is True

        neurons = api.list_neurons(cluster["id"])
        assert not any(n["id"] == neuron["id"] for n in neurons)

        restored = api.restore_neuron(neuron["id"])
        assert restored["isArchived"] is False

        api.permanent_delete_neuron(neuron["id"])

    def test_reorder_neurons(self, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        n1 = api.create_neuron("N1", brain["id"], cluster["id"])
        n2 = api.create_neuron("N2", brain["id"], cluster["id"])
        n3 = api.create_neuron("N3", brain["id"], cluster["id"])

        try:
            api.reorder_neurons([n3["id"], n1["id"], n2["id"]])
            neurons = api.list_neurons(cluster["id"])
            ordered = sorted(neurons, key=lambda n: n["sortOrder"])
            ids = [n["id"] for n in ordered]
            assert ids.index(n3["id"]) < ids.index(n1["id"]) < ids.index(n2["id"])
        finally:
            for n in [n1, n2, n3]:
                api.permanent_delete_neuron(n["id"])
