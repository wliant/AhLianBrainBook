"""E2E tests for the Trash page."""

import os

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")


class TestTrashPage:
    def test_trash_page_loads(self, home: Page):
        page = home
        page.goto(f"{BASE_URL}/trash")
        page.wait_for_load_state("networkidle")

        expect(page.get_by_role("heading", name="Trash")).to_be_visible()

    def test_sidebar_has_trash_link(self, home: Page):
        page = home
        expect(page.locator("aside nav a[href='/trash']")).to_be_visible()

    def test_deleted_neuron_appears_in_trash(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron("Trash Neuron", brain["id"], cluster["id"])
        api.delete_neuron(neuron["id"])

        try:
            navigate(page, "/trash")
            expect(page.get_by_text("Trash Neuron")).to_be_visible()
        finally:
            api.permanent_delete_neuron(neuron["id"])

    def test_restore_neuron_from_trash_page(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron("Restorable Trash Neuron", brain["id"], cluster["id"])
        api.delete_neuron(neuron["id"])

        try:
            navigate(page, "/trash")

            neuron_row = page.get_by_text("Restorable Trash Neuron").locator("..")
            neuron_row.get_by_role("button", name="Restore").click()

            page.wait_for_timeout(1000)
            expect(page.get_by_text("Restorable Trash Neuron")).not_to_be_visible()

            restored = api.get_neuron(neuron["id"])
            assert restored["isDeleted"] is False
        finally:
            api.permanent_delete_neuron(neuron["id"])

    def test_permanent_delete_from_trash_page(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron("Permanently Delete Neuron", brain["id"], cluster["id"])
        api.delete_neuron(neuron["id"])

        page.goto(f"{BASE_URL}/trash")
        page.wait_for_load_state("networkidle")

        page.on("dialog", lambda dialog: dialog.accept())

        neuron_row = page.get_by_text("Permanently Delete Neuron").locator("..")
        neuron_row.get_by_role("button", name="Delete").click()

        page.wait_for_timeout(1000)
        expect(page.get_by_text("Permanently Delete Neuron")).not_to_be_visible()

        trash = api.get_trash()
        assert not any(n["id"] == neuron["id"] for n in trash)
