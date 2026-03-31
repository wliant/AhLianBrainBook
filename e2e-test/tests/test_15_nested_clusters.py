"""E2E tests for nested cluster navigation."""

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import (
    expand_brain_in_sidebar,
    expand_cluster_in_sidebar,
    navigate,
    navigate_to_cluster,
    navigate_to_neuron,
    unique_name,
)


class TestNestedClusterSidebar:
    def test_expand_brain_shows_clusters(self, page: Page, api: BrainBookAPI, nested_clusters):
        brain, parent, child = nested_clusters
        navigate(page, "/")

        expand_brain_in_sidebar(page, brain["id"])
        expect(page.get_by_test_id(f"sidebar-cluster-{parent['id']}")).to_be_visible(timeout=5000)

    def test_expand_cluster_shows_child(self, page: Page, api: BrainBookAPI, nested_clusters):
        brain, parent, child = nested_clusters
        navigate(page, "/")

        expand_brain_in_sidebar(page, brain["id"])
        expect(page.get_by_test_id(f"sidebar-cluster-{parent['id']}")).to_be_visible(timeout=5000)

        expand_cluster_in_sidebar(page, parent["id"])
        expect(page.get_by_test_id(f"sidebar-cluster-{child['id']}")).to_be_visible(timeout=5000)

    def test_neuron_in_child_cluster_visible(self, page: Page, api: BrainBookAPI, nested_clusters):
        brain, parent, child = nested_clusters
        neuron = api.create_neuron(unique_name("Nested Neuron"), brain["id"], child["id"])
        try:
            navigate(page, "/")
            expand_brain_in_sidebar(page, brain["id"])
            expand_cluster_in_sidebar(page, parent["id"])
            expand_cluster_in_sidebar(page, child["id"])
            expect(page.get_by_test_id(f"sidebar-neuron-{neuron['id']}")).to_be_visible(timeout=5000)
        finally:
            api.permanent_delete_neuron(neuron["id"])


class TestNestedClusterBreadcrumb:
    def test_cluster_page_breadcrumb(self, page: Page, api: BrainBookAPI, nested_clusters):
        brain, parent, child = nested_clusters
        navigate_to_cluster(page, brain["id"], parent["id"])

        breadcrumb = page.get_by_test_id("breadcrumb")
        expect(breadcrumb).to_be_visible(timeout=5000)
        expect(breadcrumb.get_by_text(brain["name"])).to_be_visible()

    def test_neuron_page_breadcrumb(self, page: Page, api: BrainBookAPI, nested_clusters):
        brain, parent, child = nested_clusters
        neuron = api.create_neuron(unique_name("Breadcrumb Neuron"), brain["id"], child["id"])
        try:
            navigate_to_neuron(page, brain["id"], child["id"], neuron["id"])
            breadcrumb = page.get_by_test_id("breadcrumb")
            expect(breadcrumb).to_be_visible(timeout=5000)
            expect(breadcrumb.get_by_text(brain["name"])).to_be_visible()
            expect(breadcrumb.get_by_text(child["name"])).to_be_visible()
        finally:
            api.permanent_delete_neuron(neuron["id"])


class TestNestedClusterAPI:
    def test_create_child_cluster(self, api: BrainBookAPI, nested_clusters):
        brain, parent, child = nested_clusters
        assert child["parentClusterId"] == parent["id"]

    def test_list_clusters_includes_nested(self, api: BrainBookAPI, nested_clusters):
        brain, parent, child = nested_clusters
        clusters = api.list_clusters(brain["id"])
        ids = [c["id"] for c in clusters]
        assert parent["id"] in ids
        assert child["id"] in ids
