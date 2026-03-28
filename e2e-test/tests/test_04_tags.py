"""E2E tests for Tag management via API."""

import pytest

from helpers.api_client import BrainBookAPI


class TestTagCRUD:
    def test_create_and_list_tags(self, api: BrainBookAPI):
        tag = api.create_tag("e2e-python", "#3572A5")
        try:
            assert tag["name"] == "e2e-python"
            assert tag["color"] == "#3572A5"

            tags = api.list_tags()
            assert any(t["id"] == tag["id"] for t in tags)
        finally:
            api.delete_tag(tag["id"])

    def test_search_tags(self, api: BrainBookAPI):
        tag1 = api.create_tag("e2e-search-alpha")
        tag2 = api.create_tag("e2e-search-beta")
        try:
            results = api.search_tags("e2e-search")
            ids = [t["id"] for t in results]
            assert tag1["id"] in ids
            assert tag2["id"] in ids

            results = api.search_tags("alpha")
            ids = [t["id"] for t in results]
            assert tag1["id"] in ids
            assert tag2["id"] not in ids
        finally:
            api.delete_tag(tag1["id"])
            api.delete_tag(tag2["id"])

    def test_delete_tag(self, api: BrainBookAPI):
        tag = api.create_tag("e2e-deletable")
        api.delete_tag(tag["id"])

        tags = api.list_tags()
        assert not any(t["id"] == tag["id"] for t in tags)


class TestTagNeuronAssociation:
    def test_add_and_remove_tag_from_neuron(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        tag = api.create_tag("e2e-assoc-tag")

        try:
            # Add tag
            api.add_tag_to_neuron(neuron["id"], tag["id"])

            # Verify
            neuron_tags = api.get_neuron_tags(neuron["id"])
            assert any(t["id"] == tag["id"] for t in neuron_tags)

            # Also check via get neuron
            n = api.get_neuron(neuron["id"])
            assert any(t["id"] == tag["id"] for t in n.get("tags", []))

            # Remove tag
            api.remove_tag_from_neuron(neuron["id"], tag["id"])

            neuron_tags = api.get_neuron_tags(neuron["id"])
            assert not any(t["id"] == tag["id"] for t in neuron_tags)
        finally:
            api.delete_tag(tag["id"])

    def test_add_tag_idempotent(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        tag = api.create_tag("e2e-idempotent")

        try:
            api.add_tag_to_neuron(neuron["id"], tag["id"])
            api.add_tag_to_neuron(neuron["id"], tag["id"])  # Should not fail

            neuron_tags = api.get_neuron_tags(neuron["id"])
            matching = [t for t in neuron_tags if t["id"] == tag["id"]]
            assert len(matching) == 1
        finally:
            api.remove_tag_from_neuron(neuron["id"], tag["id"])
            api.delete_tag(tag["id"])

    def test_delete_tag_cascades_to_neuron(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        tag = api.create_tag("e2e-cascade-tag")

        api.add_tag_to_neuron(neuron["id"], tag["id"])
        api.delete_tag(tag["id"])

        neuron_tags = api.get_neuron_tags(neuron["id"])
        assert not any(t["id"] == tag["id"] for t in neuron_tags)
