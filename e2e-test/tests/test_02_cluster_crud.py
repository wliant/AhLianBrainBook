"""E2E tests for Cluster CRUD operations via browser and API."""

import os

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")


class TestClusterCreateViaBrowser:
    def test_create_cluster_from_brain_page(self, home: Page, api: BrainBookAPI, brain_with_cluster):
        brain, _ = brain_with_cluster
        page = home

        # Brain page uses prompt() for cluster creation
        page.on("dialog", lambda dialog: dialog.accept("New Test Cluster"))

        page.goto(f"{BASE_URL}/brain/{brain['id']}")
        page.wait_for_load_state("networkidle")

        page.get_by_role("button", name="New Cluster").click()
        page.wait_for_timeout(1000)

        # Verify via API
        clusters = api.list_clusters(brain["id"])
        created = [c for c in clusters if c["name"] == "New Test Cluster"]
        assert len(created) == 1

        api.delete_cluster(created[0]["id"])

    def test_create_cluster_via_api_and_verify_on_brain_page(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, _ = brain_with_cluster
        cluster = api.create_cluster("API Created Cluster", brain["id"])

        try:
            navigate(page, f"/brain/{brain['id']}")
            expect(page.get_by_text("API Created Cluster")).to_be_visible()
        finally:
            api.delete_cluster(cluster["id"])


class TestClusterNavigationViaBrowser:
    def test_brain_page_shows_clusters(self, page: Page, brain_with_cluster):
        brain, cluster = brain_with_cluster
        page.goto(f"{BASE_URL}/brain/{brain['id']}")
        page.wait_for_load_state("networkidle")

        expect(page.get_by_text(cluster["name"])).to_be_visible()

    def test_click_cluster_navigates_to_cluster_page(self, page: Page, brain_with_cluster):
        brain, cluster = brain_with_cluster
        navigate(page, f"/brain/{brain['id']}")

        # Verify cluster link exists on brain page
        link = page.locator(f"a[href='/brain/{brain['id']}/cluster/{cluster['id']}']")
        expect(link).to_be_visible()

        # Navigate directly
        navigate(page, f"/brain/{brain['id']}/cluster/{cluster['id']}")
        expect(page.get_by_role("heading", name="Neurons")).to_be_visible()

    def test_sidebar_shows_clusters_when_brain_expanded(self, page: Page, api: BrainBookAPI, brain_with_cluster):
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


class TestClusterAPIOperations:
    def test_cluster_nested_tree(self, api: BrainBookAPI, brain_with_cluster):
        brain, parent = brain_with_cluster
        child = api.create_cluster("Child Cluster", brain["id"], parent_cluster_id=parent["id"])

        try:
            assert child["parentClusterId"] == parent["id"]
            clusters = api.list_clusters(brain["id"])
            child_found = [c for c in clusters if c["id"] == child["id"]]
            assert len(child_found) == 1
            assert child_found[0]["parentClusterId"] == parent["id"]
        finally:
            api.delete_cluster(child["id"])

    def test_archive_and_restore_cluster(self, api: BrainBookAPI, brain_with_cluster):
        brain, _ = brain_with_cluster
        cluster = api.create_cluster("Archive Cluster", brain["id"])
        try:
            archived = api.archive_cluster(cluster["id"])
            assert archived["isArchived"] is True

            clusters = api.list_clusters(brain["id"])
            assert not any(c["id"] == cluster["id"] for c in clusters)

            r = api.client.post(f"/api/clusters/{cluster['id']}/restore")
            r.raise_for_status()
            restored = r.json()
            assert restored["isArchived"] is False
        finally:
            try:
                api.delete_cluster(cluster["id"])
            except Exception:
                pass

    def test_move_cluster_to_another_brain(self, api: BrainBookAPI):
        brain_a = api.create_brain("Brain A Move")
        brain_b = api.create_brain("Brain B Move")
        cluster = api.create_cluster("Movable Cluster", brain_a["id"])
        try:
            api.move_cluster(cluster["id"], brain_b["id"])

            moved = api.get_cluster(cluster["id"])
            assert moved["brainId"] == brain_b["id"]

            clusters_a = api.list_clusters(brain_a["id"])
            clusters_b = api.list_clusters(brain_b["id"])
            assert not any(c["id"] == cluster["id"] for c in clusters_a)
            assert any(c["id"] == cluster["id"] for c in clusters_b)
        finally:
            try:
                api.delete_cluster(cluster["id"])
            except Exception:
                pass
            api.delete_brain(brain_a["id"])
            api.delete_brain(brain_b["id"])
