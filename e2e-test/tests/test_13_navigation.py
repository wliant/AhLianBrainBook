"""E2E tests for sidebar navigation and routing."""

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import expand_brain_in_sidebar, navigate, navigate_to_neuron, unique_name


class TestSidebarNavigation:
    def test_sidebar_visible(self, home: Page):
        expect(home.get_by_test_id("sidebar")).to_be_visible()
        expect(home.get_by_test_id("sidebar").get_by_text("BrainBook")).to_be_visible()

    def test_sidebar_has_search_link(self, home: Page):
        expect(home.locator("aside a[href='/search']")).to_be_visible()

    def test_sidebar_has_dashboard_link(self, home: Page):
        expect(home.locator("aside nav a[href='/']")).to_be_visible()

    def test_sidebar_has_favorites_link(self, home: Page):
        expect(home.locator("aside nav a[href='/favorites']")).to_be_visible()

    def test_sidebar_has_trash_link(self, home: Page):
        expect(home.locator("aside nav a[href='/trash']")).to_be_visible()

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
        brain = api.create_brain(unique_name("Sidebar Nav Brain"))
        try:
            home.reload()
            home.wait_for_load_state("networkidle")
            expect(home.get_by_test_id(f"sidebar-brain-{brain['id']}")).to_be_visible(timeout=5000)
        finally:
            api.delete_brain(brain["id"])

    def test_expand_brain_shows_clusters(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        navigate(page, "/")

        expand_brain_in_sidebar(page, brain["id"])
        expect(page.get_by_test_id(f"sidebar-cluster-{cluster['id']}")).to_be_visible(timeout=5000)

    def test_brain_page_accessible(self, page: Page, brain_with_cluster):
        brain, cluster = brain_with_cluster
        navigate(page, f"/brain/{brain['id']}")
        expect(page.get_by_text(cluster["name"])).to_be_visible()

    def test_cluster_page_accessible(self, page: Page, brain_with_cluster):
        brain, cluster = brain_with_cluster
        navigate(page, f"/brain/{brain['id']}/cluster/{cluster['id']}")
        expect(page.get_by_role("heading", name="Neurons")).to_be_visible()


class TestEditorToolbar:
    def test_toolbar_visible_on_editor_page(self, page: Page, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        expect(page.get_by_title("Bold")).to_be_visible()
        expect(page.get_by_title("Italic")).to_be_visible()
        expect(page.get_by_title("Undo")).to_be_visible()
        expect(page.get_by_title("Redo")).to_be_visible()

    def test_bold_formatting(self, page: Page, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        editor = page.locator(".ProseMirror")
        expect(editor).to_be_visible(timeout=5000)
        editor.click()
        editor.type("Bold text")

        page.keyboard.press("Control+A")
        page.get_by_title("Bold").click()

        expect(editor.locator("strong")).to_be_visible(timeout=3000)
