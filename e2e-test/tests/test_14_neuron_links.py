"""E2E tests for neuron links / connections."""

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate_to_neuron, open_connections_panel, unique_name


class TestNeuronLinksAPI:
    def test_create_and_list_link(self, api: BrainBookAPI, two_neurons_in_cluster):
        _, _, neuron_a, neuron_b = two_neurons_in_cluster

        link = api.create_neuron_link(neuron_a["id"], neuron_b["id"], "related-to")
        assert link["sourceNeuronId"] == neuron_a["id"]
        assert link["targetNeuronId"] == neuron_b["id"]
        assert link["linkType"] == "related-to"

        links = api.list_neuron_links(neuron_a["id"])
        assert any(l["id"] == link["id"] for l in links)

        # Also visible from target neuron
        links_b = api.list_neuron_links(neuron_b["id"])
        assert any(l["id"] == link["id"] for l in links_b)

        api.delete_neuron_link(link["id"])

    def test_delete_link(self, api: BrainBookAPI, two_neurons_in_cluster):
        _, _, neuron_a, neuron_b = two_neurons_in_cluster

        link = api.create_neuron_link(neuron_a["id"], neuron_b["id"])
        api.delete_neuron_link(link["id"])

        links = api.list_neuron_links(neuron_a["id"])
        assert not any(l["id"] == link["id"] for l in links)

    def test_link_types(self, api: BrainBookAPI, two_neurons_in_cluster):
        _, _, neuron_a, neuron_b = two_neurons_in_cluster

        for link_type in ["references", "depends-on", "imports"]:
            link = api.create_neuron_link(neuron_a["id"], neuron_b["id"], link_type)
            assert link["linkType"] == link_type
            api.delete_neuron_link(link["id"])


class TestNeuronLinksBrowser:
    def test_connections_panel_opens(self, neuron_on_page):
        pg, brain, cluster, neuron = neuron_on_page
        open_connections_panel(pg)
        expect(pg.get_by_role("heading", name="Connections")).to_be_visible(timeout=5000)
        expect(pg.get_by_test_id("add-link-btn")).to_be_visible(timeout=5000)

    def test_connections_panel_shows_links(self, page: Page, api: BrainBookAPI, two_neurons_in_cluster):
        brain, cluster, neuron_a, neuron_b = two_neurons_in_cluster

        link = api.create_neuron_link(neuron_a["id"], neuron_b["id"], "related-to")
        try:
            navigate_to_neuron(page, brain["id"], cluster["id"], neuron_a["id"])
            open_connections_panel(page)
            expect(page.get_by_text("Outgoing")).to_be_visible(timeout=5000)
            expect(page.get_by_text(neuron_b["title"])).to_be_visible(timeout=5000)
        finally:
            api.delete_neuron_link(link["id"])

    def test_add_link_dialog_opens(self, neuron_on_page):
        pg, brain, cluster, neuron = neuron_on_page
        open_connections_panel(pg)
        pg.get_by_test_id("add-link-btn").click()
        expect(pg.get_by_test_id("add-link-dialog")).to_be_visible(timeout=5000)
        expect(pg.get_by_test_id("link-search-input")).to_be_visible(timeout=5000)
