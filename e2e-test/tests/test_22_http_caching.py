"""E2E tests for HTTP caching headers."""

import httpx

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import unique_name


class TestHttpCacheHeaders:
    def test_brains_endpoint_has_cache_control(self, api: BrainBookAPI):
        """GET /api/brains should return Cache-Control: private, max-age=60."""
        r = api.client.get("/api/brains")
        assert r.status_code == 200
        cc = r.headers.get("cache-control", "")
        assert "max-age=60" in cc
        assert "private" in cc

    def test_tags_endpoint_has_cache_control(self, api: BrainBookAPI):
        """GET /api/tags should return Cache-Control: private, max-age=60."""
        r = api.client.get("/api/tags")
        assert r.status_code == 200
        cc = r.headers.get("cache-control", "")
        assert "max-age=60" in cc
        assert "private" in cc

    def test_settings_endpoint_has_cache_control(self, api: BrainBookAPI):
        """GET /api/settings should return Cache-Control: private, max-age=300."""
        r = api.client.get("/api/settings")
        assert r.status_code == 200
        cc = r.headers.get("cache-control", "")
        assert "max-age=300" in cc
        assert "private" in cc

    def test_post_request_has_no_store(self, api: BrainBookAPI):
        """POST requests should return Cache-Control: no-store."""
        brain = api.create_brain(unique_name("Cache Test Brain"))
        try:
            # The create_brain call already completed; make a direct POST to check headers
            r = api.client.post("/api/brains", json={"name": unique_name("Cache Header Brain")})
            assert r.status_code == 201
            cc = r.headers.get("cache-control", "")
            assert "no-store" in cc
            # Clean up the extra brain
            extra_brain = r.json()
            api.delete_brain(extra_brain["id"])
        finally:
            api.delete_brain(brain["id"])

    def test_neuron_etag_and_conditional_request(self, api: BrainBookAPI, neuron_in_cluster):
        """GET /api/neurons/{id} should return ETag and support If-None-Match → 304."""
        _, _, neuron = neuron_in_cluster

        # First request — get ETag
        r1 = api.client.get(f"/api/neurons/{neuron['id']}")
        assert r1.status_code == 200
        etag = r1.headers.get("etag")
        assert etag is not None, "Response should include ETag header"

        # Second request with If-None-Match — should get 304
        r2 = api.client.get(f"/api/neurons/{neuron['id']}", headers={"If-None-Match": etag})
        assert r2.status_code == 304
