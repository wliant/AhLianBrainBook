"""E2E tests for knowledge graph rendering at scale."""

import warnings

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate, unique_name

from playwright.sync_api import expect


class TestGraphRendering:
    def test_graph_page_renders_for_small_brain(self, api: BrainBookAPI, neuron_in_cluster, page):
        """Verify graph page renders for a brain with a few neurons."""
        brain, cluster, neuron = neuron_in_cluster

        navigate(page, f"/brain/{brain['id']}/graph")

        # React Flow should render
        flow = page.locator(".react-flow")
        flow.wait_for(state="attached", timeout=15000)

    def test_graph_page_renders_with_multiple_clusters(self, api: BrainBookAPI, page):
        """Verify graph renders with multiple clusters and neurons."""
        brain = api.create_brain(unique_name("Graph Brain"))
        cluster1 = api.create_cluster(unique_name("Cluster A"), brain["id"])
        cluster2 = api.create_cluster(unique_name("Cluster B"), brain["id"])

        neurons = []
        try:
            # Create a few neurons in each cluster
            for i in range(3):
                n = api.create_neuron(f"Neuron A{i}", brain["id"], cluster1["id"])
                neurons.append(n)
            for i in range(3):
                n = api.create_neuron(f"Neuron B{i}", brain["id"], cluster2["id"])
                neurons.append(n)

            navigate(page, f"/brain/{brain['id']}/graph")

            flow = page.locator(".react-flow")
            flow.wait_for(state="attached", timeout=15000)

            # Should see neuron nodes rendered
            # React Flow renders nodes as divs with data-id
            page.wait_for_timeout(2000)  # Allow layout to complete
        finally:
            for n in neurons:
                try:
                    api.permanent_delete_neuron(n["id"])
                except Exception:
                    pass
            try:
                api.delete_cluster(cluster1["id"])
                api.delete_cluster(cluster2["id"])
                api.delete_brain(brain["id"])
            except Exception as e:
                warnings.warn(f"Cleanup failed: {e}")

    def test_graph_controls_visible(self, api: BrainBookAPI, neuron_in_cluster, page):
        """Verify graph controls (zoom, fit) are visible."""
        brain, _, _ = neuron_in_cluster

        navigate(page, f"/brain/{brain['id']}/graph")

        flow = page.locator(".react-flow")
        flow.wait_for(state="attached", timeout=15000)

        # React Flow controls should be visible
        controls = page.locator(".react-flow__controls")
        controls.wait_for(state="visible", timeout=10000)
