"""E2E tests for the Favorites page."""

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate, navigate_to_neuron, unique_name


class TestFavoritesPage:
    def test_favorites_page_loads(self, page: Page):
        navigate(page, "/favorites")
        expect(page.get_by_role("heading", name="Favorites")).to_be_visible()

    def test_favorited_neuron_appears_on_favorites_page(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron(unique_name("Favorites Page Neuron"), brain["id"], cluster["id"])
        api.toggle_favorite(neuron["id"])

        try:
            navigate(page, "/favorites")
            expect(page.get_by_text(neuron["title"])).to_be_visible(timeout=5000)
        finally:
            api.toggle_favorite(neuron["id"])
            api.permanent_delete_neuron(neuron["id"])

    def test_favorites_neuron_links_to_editor(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron(unique_name("Fav Link Neuron"), brain["id"], cluster["id"])
        api.toggle_favorite(neuron["id"])

        try:
            navigate(page, "/favorites")
            link = page.locator(f"a[href*='/neuron/{neuron['id']}']")
            expect(link).to_be_visible(timeout=5000)

            navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
            expect(page.get_by_test_id("neuron-title-input")).to_have_value(neuron["title"])
        finally:
            api.toggle_favorite(neuron["id"])
            api.permanent_delete_neuron(neuron["id"])

    def test_sidebar_has_favorites_link(self, home: Page):
        expect(home.locator("aside nav a[href='/favorites']")).to_be_visible()
