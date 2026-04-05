"""E2E tests for neuron sharing (GAP-001)."""

import pytest
from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate_to_neuron, unique_name


class TestNeuronSharingAPI:
    """API-level sharing tests."""

    def test_create_share_link(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        share = api.create_share(neuron["id"])

        assert share["token"] is not None
        assert len(share["token"]) == 64
        assert share["expiresAt"] is None

    def test_create_share_with_expiry(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        share = api.create_share(neuron["id"], expires_in_hours=24)

        assert share["expiresAt"] is not None

    def test_public_page_accessible(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        share = api.create_share(neuron["id"])

        shared = api.get_shared_neuron(share["token"])

        assert shared is not None
        assert shared["title"] == neuron["title"]

    def test_revoke_removes_access(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        share = api.create_share(neuron["id"])
        api.revoke_share(share["id"])

        shared = api.get_shared_neuron(share["token"])
        assert shared is None

    def test_list_shares(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        api.create_share(neuron["id"])
        api.create_share(neuron["id"])

        shares = api.get_shares(neuron["id"])
        assert len(shares) >= 2

    def test_unknown_token_returns_none(self, api: BrainBookAPI):
        shared = api.get_shared_neuron("0" * 64)
        assert shared is None


@pytest.mark.browser
class TestNeuronSharingBrowser:
    """Browser-level sharing tests."""

    def test_share_dialog_opens(self, page, api, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        page.get_by_role("button", name="Share").click()
        page.wait_for_timeout(500)

        # Share dialog should be visible
        assert page.get_by_test_id("create-share-btn").is_visible() or \
               page.get_by_text("Generate Link").is_visible()
