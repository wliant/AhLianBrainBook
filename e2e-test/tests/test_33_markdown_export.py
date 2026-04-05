"""E2E tests for markdown export (GAP-005)."""

import pytest
from helpers.api_client import BrainBookAPI
from helpers.page_helpers import unique_name


class TestMarkdownExport:
    """API-level markdown export tests."""

    def test_export_neuron_markdown(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        md = api.export_neuron_markdown(neuron["id"])

        assert neuron["title"] in md
        assert md.startswith("#")

    def test_export_brain_markdown_zip(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        zip_bytes = api.export_brain_markdown(brain["id"])

        assert len(zip_bytes) > 0
        # ZIP magic bytes: PK
        assert zip_bytes[0:2] == b"PK"

    def test_export_neuron_with_content(self, api: BrainBookAPI, neuron_with_content):
        brain, cluster, neuron = neuron_with_content
        md = api.export_neuron_markdown(neuron["id"])

        assert "Test content for revision" in md
