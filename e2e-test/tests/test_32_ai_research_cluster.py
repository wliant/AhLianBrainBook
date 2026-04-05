"""E2E tests for AI research cluster (GAP-011)."""

import pytest
from helpers.api_client import BrainBookAPI
from helpers.page_helpers import unique_name


class TestAiResearchClusterAPI:
    """API-level research cluster tests."""

    def test_create_research_cluster(self, api: BrainBookAPI):
        brain = api.create_brain(unique_name("Research Brain"))
        try:
            cluster = api.create_cluster("AI Research", brain["id"], cluster_type="ai-research")
            assert cluster["type"] == "ai-research"
        finally:
            api.delete_brain(brain["id"])

    def test_duplicate_research_cluster_rejected(self, api: BrainBookAPI):
        brain = api.create_brain(unique_name("Research Dup Brain"))
        try:
            api.create_cluster("AI Research", brain["id"], cluster_type="ai-research")
            import httpx
            r = api.client.post("/api/clusters", json={
                "name": "AI Research 2", "brainId": brain["id"], "type": "ai-research"
            })
            assert r.status_code == 409
        finally:
            api.delete_brain(brain["id"])
