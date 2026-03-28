"""E2E tests for sidebar navigation and routing."""

import os

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")


class TestSidebarNavigation:
    def test_sidebar_visible(self, home: Page):
        page = home
        sidebar = page.locator("aside")
        expect(sidebar.get_by_text("BrainBook")).to_be_visible()

    def test_sidebar_has_search_link(self, home: Page):
        page = home
        expect(page.locator("aside a[href='/search']")).to_be_visible()

    def test_sidebar_has_dashboard_link(self, home: Page):
        page = home
        expect(page.locator("aside nav a[href='/']")).to_be_visible()

    def test_sidebar_has_favorites_link(self, home: Page):
        page = home
        expect(page.locator("aside nav a[href='/favorites']")).to_be_visible()

    def test_sidebar_has_trash_link(self, home: Page):
        page = home
        expect(page.locator("aside nav a[href='/trash']")).to_be_visible()

    def test_search_page_accessible(self, page: Page):
        navigate(page, "/search")
        expect(page.get_by_placeholder("Search neurons...")).to_be_visible()

    def test_favorites_page_accessible(self, page: Page):
        navigate(page, "/favorites")
        expect(page.get_by_role("heading", name="Favorites")).to_be_visible()

    def test_trash_page_accessible(self, page: Page):
        navigate(page, "/trash")
        expect(page.get_by_role("heading", name="Trash")).to_be_visible()


class TestBrainNavigation:
    def test_brain_list_in_sidebar(self, home: Page, api: BrainBookAPI):
        brain = api.create_brain("Sidebar Nav Brain")
        try:
            page = home
            page.reload()
            page.wait_for_load_state("networkidle")

            sidebar = page.locator("aside")
            expect(sidebar.get_by_text("Sidebar Nav Brain")).to_be_visible()
        finally:
            api.delete_brain(brain["id"])

    def test_expand_brain_shows_clusters(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")

        sidebar = page.locator("aside")
        brain_link = sidebar.locator(f"a[href='/brain/{brain['id']}']")
        brain_row = brain_link.locator("..")
        chevron = brain_row.locator("button").first
        chevron.click()

        page.wait_for_timeout(1000)
        expect(sidebar.get_by_text(cluster["name"])).to_be_visible()

    def test_brain_page_accessible(self, page: Page, brain_with_cluster):
        brain, cluster = brain_with_cluster
        navigate(page, f"/brain/{brain['id']}")
        expect(page.get_by_text(cluster["name"])).to_be_visible()

    def test_cluster_page_accessible(self, page: Page, brain_with_cluster):
        brain, cluster = brain_with_cluster
        navigate(page, f"/brain/{brain['id']}/cluster/{cluster['id']}")
        expect(page.get_by_role("heading", name="Neurons")).to_be_visible()


class TestEditorToolbar:
    def test_toolbar_visible_on_editor_page(self, home: Page, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        page = home
        page.goto(f"{BASE_URL}/brain/{brain['id']}/cluster/{cluster['id']}/neuron/{neuron['id']}")
        page.wait_for_load_state("networkidle")

        expect(page.get_by_title("Bold")).to_be_visible()
        expect(page.get_by_title("Italic")).to_be_visible()
        expect(page.get_by_title("Undo")).to_be_visible()
        expect(page.get_by_title("Redo")).to_be_visible()

    def test_bold_formatting(self, home: Page, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        page = home
        page.goto(f"{BASE_URL}/brain/{brain['id']}/cluster/{cluster['id']}/neuron/{neuron['id']}")
        page.wait_for_load_state("networkidle")

        editor = page.locator(".ProseMirror")
        editor.click()
        editor.type("Bold text")

        page.keyboard.press("Control+A")
        page.get_by_title("Bold").click()

        bold_content = editor.locator("strong")
        expect(bold_content).to_be_visible()
