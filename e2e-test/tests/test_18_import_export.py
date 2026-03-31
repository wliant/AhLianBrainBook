"""E2E tests for brain import/export (API-only, no UI exists)."""

import os

import pytest

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import unique_name


class TestImportExport:
    def test_export_brain(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        export = api.export_brain(brain["id"])

        assert export["brain"]["name"] == brain["name"]
        assert "clusters" in export or "neurons" in export or "id" in export

    def test_export_contains_neurons(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster

        # Tag the neuron
        tag = api.create_tag(unique_name("ExportTag"))
        api.add_tag_to_neuron(neuron["id"], tag["id"])

        try:
            export = api.export_brain(brain["id"])
            # Export should contain some reference to our data
            export_str = str(export)
            assert neuron["title"] in export_str or cluster["name"] in export_str
        finally:
            api.delete_tag(tag["id"])

    def test_import_brain_round_trip(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster

        # Export
        export = api.export_brain(brain["id"])

        # Build import payload from export (different structure)
        import_name = unique_name("Imported Brain")
        import_payload = {
            "name": import_name,
            "description": export["brain"].get("description", ""),
            "clusters": export.get("clusters", []),
            "tags": export.get("tags", []),
            "links": export.get("links", []),
        }

        # Import
        imported = api.import_brain(import_payload)
        try:
            assert imported["name"] == import_name
            assert imported["id"] != brain["id"]

            # Verify imported brain has clusters
            clusters = api.list_clusters(imported["id"])
            assert len(clusters) >= 1
        finally:
            # Cleanup imported brain
            try:
                clusters = api.list_clusters(imported["id"])
                for c in clusters:
                    neurons = api.list_neurons(c["id"])
                    for n in neurons:
                        api.permanent_delete_neuron(n["id"])
                    api.delete_cluster(c["id"])
                api.delete_brain(imported["id"])
            except Exception:
                pass
