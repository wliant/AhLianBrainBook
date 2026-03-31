"""E2E tests for the Trash page."""

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate, unique_name


class TestTrashPage:
    def test_trash_page_loads(self, page: Page):
        navigate(page, "/trash")
        expect(page.get_by_role("heading", name="Trash")).to_be_visible()

    def test_sidebar_has_trash_link(self, home: Page):
        expect(home.locator("aside nav a[href='/trash']")).to_be_visible()

    def test_deleted_neuron_appears_in_trash(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron(unique_name("Trash Neuron"), brain["id"], cluster["id"])
        api.delete_neuron(neuron["id"])

        try:
            navigate(page, "/trash")
            expect(page.get_by_text(neuron["title"])).to_be_visible(timeout=5000)
        finally:
            api.permanent_delete_neuron(neuron["id"])

    def test_restore_neuron_from_trash_page(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron(unique_name("Restorable Trash Neuron"), brain["id"], cluster["id"])
        api.delete_neuron(neuron["id"])

        try:
            navigate(page, "/trash")

            page.get_by_test_id(f"trash-restore-{neuron['id']}").click()

            expect(page.get_by_text(neuron["title"])).not_to_be_visible(timeout=5000)

            restored = api.get_neuron(neuron["id"])
            assert restored["isDeleted"] is False
        finally:
            api.permanent_delete_neuron(neuron["id"])

    def test_permanent_delete_from_trash_page(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron(unique_name("Permanently Delete Neuron"), brain["id"], cluster["id"])
        api.delete_neuron(neuron["id"])

        navigate(page, "/trash")

        page.on("dialog", lambda dialog: dialog.accept())

        page.get_by_test_id(f"trash-delete-{neuron['id']}").click()

        expect(page.get_by_text(neuron["title"])).not_to_be_visible(timeout=5000)

        trash = api.get_trash()
        assert not any(n["id"] == neuron["id"] for n in trash)
