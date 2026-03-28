"""E2E tests for the Dashboard page."""

import os

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")


class TestDashboardSections:
    def test_dashboard_shows_brainbook_heading(self, home: Page):
        page = home
        expect(page.get_by_role("heading", name="BrainBook", level=1)).to_be_visible()
        expect(page.get_by_text("Your personal technical notebook")).to_be_visible()

    def test_dashboard_shows_recent_neurons(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron("Recent Dashboard Neuron", brain["id"], cluster["id"])

        try:
            navigate(page, "/")
            # Wait for client-side data fetch
            page.wait_for_timeout(2000)

            main = page.locator("main")
            expect(main.get_by_role("heading", name="Recent")).to_be_visible(timeout=10000)
            expect(main.get_by_text("Recent Dashboard Neuron").first).to_be_visible(timeout=10000)
        finally:
            api.permanent_delete_neuron(neuron["id"])

    def test_dashboard_shows_pinned_section(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron("Pinned Dashboard Neuron", brain["id"], cluster["id"])
        api.toggle_pin(neuron["id"])

        try:
            navigate(page, "/")
            page.wait_for_timeout(2000)

            main = page.locator("main")
            expect(main.get_by_role("heading", name="Pinned")).to_be_visible(timeout=10000)
            expect(main.get_by_text("Pinned Dashboard Neuron").first).to_be_visible(timeout=10000)
        finally:
            api.toggle_pin(neuron["id"])
            api.permanent_delete_neuron(neuron["id"])

    def test_dashboard_shows_favorites_section(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron("Favorite Dashboard Neuron", brain["id"], cluster["id"])
        api.toggle_favorite(neuron["id"])

        try:
            navigate(page, "/")
            page.wait_for_timeout(2000)

            main = page.locator("main")
            expect(main.get_by_role("heading", name="Favorites")).to_be_visible(timeout=10000)
            expect(main.get_by_text("Favorite Dashboard Neuron").first).to_be_visible(timeout=10000)
        finally:
            api.toggle_favorite(neuron["id"])
            api.permanent_delete_neuron(neuron["id"])

    def test_dashboard_neuron_links_to_editor(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        neuron = api.create_neuron("Clickable Dashboard Neuron", brain["id"], cluster["id"])

        try:
            navigate(page, "/")
            page.wait_for_timeout(2000)

            main = page.locator("main")
            link = main.locator(f"a[href*='/neuron/{neuron['id']}']")
            expect(link).to_be_visible(timeout=10000)

            navigate(page, f"/brain/{brain['id']}/cluster/{cluster['id']}/neuron/{neuron['id']}")
            expect(page.get_by_placeholder("Untitled")).to_have_value("Clickable Dashboard Neuron")
        finally:
            api.permanent_delete_neuron(neuron["id"])
