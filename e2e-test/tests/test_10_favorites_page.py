"""E2E tests for the Favorites page."""

import os

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")


class TestFavoritesPage:
    def test_favorites_page_loads(self, home: Page):
        page = home
        page.goto(f"{BASE_URL}/favorites")
        page.wait_for_load_state("networkidle")

        expect(page.get_by_role("heading", name="Favorites")).to_be_visible()

    def test_favorited_neuron_appears_on_favorites_page(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron("Favorites Page Neuron", brain["id"], cluster["id"])
        api.toggle_favorite(neuron["id"])

        try:
            navigate(page, "/favorites")
            expect(page.get_by_text("Favorites Page Neuron")).to_be_visible()
        finally:
            api.toggle_favorite(neuron["id"])
            api.permanent_delete_neuron(neuron["id"])

    def test_favorites_neuron_links_to_editor(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron("Fav Link Neuron", brain["id"], cluster["id"])
        api.toggle_favorite(neuron["id"])

        try:
            navigate(page, "/favorites")
            # Verify the link href exists
            link = page.locator(f"a[href*='/neuron/{neuron['id']}']")
            expect(link).to_be_visible()

            # Navigate directly to verify the editor page works
            navigate(page, f"/brain/{brain['id']}/cluster/{cluster['id']}/neuron/{neuron['id']}")
            expect(page.get_by_placeholder("Untitled")).to_have_value("Fav Link Neuron")
        finally:
            api.toggle_favorite(neuron["id"])
            api.permanent_delete_neuron(neuron["id"])

    def test_sidebar_has_favorites_link(self, home: Page):
        page = home
        expect(page.locator("aside nav a[href='/favorites']")).to_be_visible()
