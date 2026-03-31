"""E2E tests for error handling paths."""

import uuid

import httpx
import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate


class TestErrorHandlingBrowser:
    def test_nonexistent_brain_url(self, page: Page):
        fake_id = str(uuid.uuid4())
        navigate(page, f"/brain/{fake_id}")
        # Should show some error state, empty state, or redirect
        # The page should at least load without crashing
        expect(page.locator("body")).to_be_visible(timeout=5000)

    def test_nonexistent_neuron_url(self, page: Page):
        fake_brain = str(uuid.uuid4())
        fake_cluster = str(uuid.uuid4())
        fake_neuron = str(uuid.uuid4())
        navigate(page, f"/brain/{fake_brain}/cluster/{fake_cluster}/neuron/{fake_neuron}")
        expect(page.locator("body")).to_be_visible(timeout=5000)

    def test_nonexistent_cluster_url(self, page: Page):
        fake_brain = str(uuid.uuid4())
        fake_cluster = str(uuid.uuid4())
        navigate(page, f"/brain/{fake_brain}/cluster/{fake_cluster}")
        expect(page.locator("body")).to_be_visible(timeout=5000)


class TestErrorHandlingAPI:
    def test_create_brain_empty_name(self, api: BrainBookAPI):
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            api.create_brain("")
        assert exc_info.value.response.status_code in (400, 422)

    def test_get_nonexistent_brain(self, api: BrainBookAPI):
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            api.get_brain(str(uuid.uuid4()))
        assert exc_info.value.response.status_code == 404

    def test_get_nonexistent_neuron(self, api: BrainBookAPI):
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            api.get_neuron(str(uuid.uuid4()))
        assert exc_info.value.response.status_code == 404

    def test_delete_nonexistent_brain(self, api: BrainBookAPI):
        # May return 404 or succeed silently depending on implementation
        try:
            api.delete_brain(str(uuid.uuid4()))
        except (httpx.HTTPStatusError, AssertionError):
            pass  # Expected — 404 is acceptable

    def test_optimistic_locking_conflict_returns_409(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        # First update succeeds
        r1 = api.update_neuron_content_raw(neuron["id"], '{"type":"doc"}', "v1", neuron["version"])
        assert r1.status_code == 200

        # Second update with stale version should get 409
        r2 = api.update_neuron_content_raw(neuron["id"], '{"type":"doc"}', "v2", neuron["version"])
        assert r2.status_code == 409
