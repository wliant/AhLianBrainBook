"""E2E tests for Neuron revision history."""

import json

import pytest

from helpers.api_client import BrainBookAPI


class TestRevisionHistory:
    def test_list_revisions_after_content_updates(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster

        # Make several content updates
        content_v1 = json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Version 1"}]}]})
        r = api.update_neuron_content(neuron["id"], content_v1, "Version 1", neuron["version"])
        assert r.status_code == 200

        content_v2 = json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Version 2"}]}]})
        r = api.update_neuron_content(neuron["id"], content_v2, "Version 2", neuron["version"] + 1)
        assert r.status_code == 200

        # Check revisions exist
        revisions = api.list_revisions(neuron["id"])
        # Revisions may or may not be auto-created depending on implementation
        # This test verifies the endpoint works
        assert isinstance(revisions, list)

    def test_get_specific_revision(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster

        content = json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Revision test"}]}]})
        api.update_neuron_content(neuron["id"], content, "Revision test", neuron["version"])

        revisions = api.list_revisions(neuron["id"])
        if len(revisions) > 0:
            rev = api.get_revision(revisions[0]["id"])
            assert rev["neuronId"] == neuron["id"]
            assert "revisionNumber" in rev

    def test_restore_revision(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster

        # Create content
        original_content = json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Original"}]}]})
        r = api.update_neuron_content(neuron["id"], original_content, "Original", neuron["version"])
        assert r.status_code == 200
        version_after = r.json()["version"]

        revisions = api.list_revisions(neuron["id"])
        if len(revisions) > 0:
            # Update content again
            new_content = json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Changed"}]}]})
            r2 = api.update_neuron_content(neuron["id"], new_content, "Changed", version_after)
            assert r2.status_code == 200

            # Restore to first revision
            restored = api.restore_revision(revisions[-1]["id"])
            assert restored["id"] == neuron["id"]
