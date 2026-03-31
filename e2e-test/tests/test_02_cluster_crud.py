"""E2E tests for Cluster CRUD operations via browser and API."""

import warnings

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import (
    expand_brain_in_sidebar,
    navigate,
    navigate_to_brain,
    unique_name,
)


class TestClusterCreateViaBrowser:
    def test_create_cluster_from_brain_page(self, home: Page, api: BrainBookAPI, brain_with_cluster):
        brain, _ = brain_with_cluster
        page = home

        cluster_name = unique_name("New Test Cluster")

        # Brain page uses prompt() for cluster creation
        page.on("dialog", lambda dialog: dialog.accept(cluster_name))

        navigate_to_brain(page, brain["id"])

        page.get_by_test_id("new-cluster-btn").click()

        # Verify via API — poll until cluster appears
        expect(page.get_by_text(cluster_name)).to_be_visible(timeout=5000)

        clusters = api.list_clusters(brain["id"])
        created = [c for c in clusters if c["name"] == cluster_name]
        assert len(created) == 1

        api.delete_cluster(created[0]["id"])

    def test_create_cluster_via_api_and_verify_on_brain_page(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, _ = brain_with_cluster
        cluster = api.create_cluster(unique_name("API Created Cluster"), brain["id"])

        try:
            navigate_to_brain(page, brain["id"])
            expect(page.get_by_text(cluster["name"])).to_be_visible(timeout=5000)
        finally:
            api.delete_cluster(cluster["id"])


class TestClusterNavigationViaBrowser:
    def test_brain_page_shows_clusters(self, page: Page, brain_with_cluster):
        brain, cluster = brain_with_cluster
        navigate_to_brain(page, brain["id"])
        expect(page.get_by_text(cluster["name"])).to_be_visible(timeout=5000)

    def test_click_cluster_navigates_to_cluster_page(self, page: Page, brain_with_cluster):
        brain, cluster = brain_with_cluster
        navigate_to_brain(page, brain["id"])

        link = page.locator(f"a[href='/brain/{brain['id']}/cluster/{cluster['id']}']")
        expect(link).to_be_visible()

        navigate(page, f"/brain/{brain['id']}/cluster/{cluster['id']}")
        expect(page.get_by_role("heading", name="Neurons")).to_be_visible()

    def test_sidebar_shows_clusters_when_brain_expanded(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster

        navigate(page, "/")

        expand_brain_in_sidebar(page, brain["id"])
        expect(page.get_by_test_id(f"sidebar-cluster-{cluster['id']}")).to_be_visible(timeout=5000)


class TestClusterAPIOperations:
    def test_cluster_nested_tree(self, api: BrainBookAPI, brain_with_cluster):
        brain, parent = brain_with_cluster
        child = api.create_cluster(unique_name("Child Cluster"), brain["id"], parent_cluster_id=parent["id"])

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
        cluster = api.create_cluster(unique_name("Archive Cluster"), brain["id"])
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
            except Exception as e:
                warnings.warn(f"Cleanup failed for cluster {cluster['id']}: {e}")

    def test_move_cluster_to_another_brain(self, api: BrainBookAPI):
        brain_a = api.create_brain(unique_name("Brain A Move"))
        brain_b = api.create_brain(unique_name("Brain B Move"))
        cluster = api.create_cluster(unique_name("Movable Cluster"), brain_a["id"])
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
            except Exception as e:
                warnings.warn(f"Cleanup failed for cluster {cluster['id']}: {e}")
            api.delete_brain(brain_a["id"])
            api.delete_brain(brain_b["id"])
