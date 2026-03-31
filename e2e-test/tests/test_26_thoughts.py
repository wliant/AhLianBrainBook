"""E2E tests for Thoughts (tag-based filtered neuron views)."""

import warnings

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate, unique_name


# ── API Tests ──


class TestThoughtsAPI:
    def test_create_thought(self, api: BrainBookAPI):
        tag = api.create_tag(unique_name("thought-tag"))
        try:
            thought = api.create_thought(unique_name("Test Thought"), [tag["id"]])
            try:
                assert thought["name"].startswith("Test Thought")
                assert thought["neuronTagMode"] == "any"
                assert thought["brainTagMode"] == "any"
                assert len(thought["neuronTags"]) == 1
                assert thought["neuronTags"][0]["id"] == tag["id"]
                assert thought["brainTags"] == []
            finally:
                api.delete_thought(thought["id"])
        finally:
            api.delete_tag(tag["id"])

    def test_list_thoughts(self, api: BrainBookAPI):
        tag = api.create_tag(unique_name("list-tag"))
        try:
            t1 = api.create_thought(unique_name("Thought A"), [tag["id"]])
            t2 = api.create_thought(unique_name("Thought B"), [tag["id"]])
            try:
                thoughts = api.list_thoughts()
                ids = [t["id"] for t in thoughts]
                assert t1["id"] in ids
                assert t2["id"] in ids
            finally:
                api.delete_thought(t2["id"])
                api.delete_thought(t1["id"])
        finally:
            api.delete_tag(tag["id"])

    def test_get_thought(self, api: BrainBookAPI):
        tag = api.create_tag(unique_name("get-tag"))
        try:
            thought = api.create_thought(unique_name("Get Thought"), [tag["id"]])
            try:
                fetched = api.get_thought(thought["id"])
                assert fetched["name"] == thought["name"]
                assert len(fetched["neuronTags"]) == 1
            finally:
                api.delete_thought(thought["id"])
        finally:
            api.delete_tag(tag["id"])

    def test_update_thought(self, api: BrainBookAPI):
        tag_a = api.create_tag(unique_name("upd-tag-a"))
        tag_b = api.create_tag(unique_name("upd-tag-b"))
        try:
            thought = api.create_thought(unique_name("Before Update"), [tag_a["id"]])
            try:
                updated = api.update_thought(
                    thought["id"],
                    name="After Update",
                    description="Updated desc",
                    neuronTagMode="all",
                    neuronTagIds=[tag_a["id"], tag_b["id"]],
                )
                assert updated["name"] == "After Update"
                assert updated["description"] == "Updated desc"
                assert updated["neuronTagMode"] == "all"
                assert len(updated["neuronTags"]) == 2
            finally:
                api.delete_thought(thought["id"])
        finally:
            api.delete_tag(tag_b["id"])
            api.delete_tag(tag_a["id"])

    def test_delete_thought(self, api: BrainBookAPI):
        tag = api.create_tag(unique_name("del-tag"))
        try:
            thought = api.create_thought(unique_name("Delete Me"), [tag["id"]])
            api.delete_thought(thought["id"])
            thoughts = api.list_thoughts()
            assert not any(t["id"] == thought["id"] for t in thoughts)
        finally:
            api.delete_tag(tag["id"])

    def test_resolve_neurons_any_mode(self, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        tag_x = api.create_tag(unique_name("any-x"))
        tag_y = api.create_tag(unique_name("any-y"))
        try:
            n_a = api.create_neuron(unique_name("Neuron A"), brain["id"], cluster["id"])
            n_b = api.create_neuron(unique_name("Neuron B"), brain["id"], cluster["id"])
            n_c = api.create_neuron(unique_name("Neuron C"), brain["id"], cluster["id"])

            api.add_tag_to_neuron(n_a["id"], tag_x["id"])
            api.add_tag_to_neuron(n_b["id"], tag_y["id"])
            api.add_tag_to_neuron(n_c["id"], tag_x["id"])
            api.add_tag_to_neuron(n_c["id"], tag_y["id"])

            thought = api.create_thought(
                unique_name("Any Mode"), [tag_x["id"], tag_y["id"]], neuron_tag_mode="any"
            )
            try:
                neurons = api.get_thought_neurons(thought["id"])
                neuron_ids = {n["id"] for n in neurons}
                assert n_a["id"] in neuron_ids
                assert n_b["id"] in neuron_ids
                assert n_c["id"] in neuron_ids
            finally:
                api.delete_thought(thought["id"])
        finally:
            api.delete_tag(tag_y["id"])
            api.delete_tag(tag_x["id"])

    def test_resolve_neurons_all_mode(self, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        tag_x = api.create_tag(unique_name("all-x"))
        tag_y = api.create_tag(unique_name("all-y"))
        try:
            n_a = api.create_neuron(unique_name("Neuron A"), brain["id"], cluster["id"])
            n_b = api.create_neuron(unique_name("Neuron B"), brain["id"], cluster["id"])
            n_c = api.create_neuron(unique_name("Neuron C"), brain["id"], cluster["id"])

            api.add_tag_to_neuron(n_a["id"], tag_x["id"])
            api.add_tag_to_neuron(n_b["id"], tag_y["id"])
            api.add_tag_to_neuron(n_c["id"], tag_x["id"])
            api.add_tag_to_neuron(n_c["id"], tag_y["id"])

            thought = api.create_thought(
                unique_name("All Mode"), [tag_x["id"], tag_y["id"]], neuron_tag_mode="all"
            )
            try:
                neurons = api.get_thought_neurons(thought["id"])
                neuron_ids = {n["id"] for n in neurons}
                assert n_c["id"] in neuron_ids
                assert n_a["id"] not in neuron_ids
                assert n_b["id"] not in neuron_ids
            finally:
                api.delete_thought(thought["id"])
        finally:
            api.delete_tag(tag_y["id"])
            api.delete_tag(tag_x["id"])

    def test_resolve_neurons_empty_when_no_match(self, api: BrainBookAPI):
        tag = api.create_tag(unique_name("no-match"))
        try:
            thought = api.create_thought(unique_name("Empty Thought"), [tag["id"]])
            try:
                neurons = api.get_thought_neurons(thought["id"])
                assert neurons == []
            finally:
                api.delete_thought(thought["id"])
        finally:
            api.delete_tag(tag["id"])


# ── Browser Tests ──


class TestThoughtsBrowser:
    def test_thoughts_page_loads(self, page: Page):
        navigate(page, "/thoughts")
        expect(page.get_by_test_id("create-thought-button")).to_be_visible(timeout=5000)

    def test_thought_card_links_to_viewer(self, page: Page, api: BrainBookAPI):
        tag = api.create_tag(unique_name("card-tag"))
        try:
            thought = api.create_thought(unique_name("Card Thought"), [tag["id"]])
            try:
                navigate(page, "/thoughts")
                card = page.get_by_test_id(f"thought-card-{thought['id']}")
                expect(card).to_be_visible(timeout=5000)
                card.click()
                page.wait_for_url(f"**/thoughts/{thought['id']}")
                expect(page.get_by_test_id("thought-viewer")).to_be_visible(timeout=5000)
                expect(page.get_by_role("heading", name=thought["name"])).to_be_visible()
            finally:
                api.delete_thought(thought["id"])
        finally:
            api.delete_tag(tag["id"])

    def test_delete_thought_from_viewer(self, page: Page, api: BrainBookAPI):
        tag = api.create_tag(unique_name("del-view-tag"))
        try:
            thought = api.create_thought(unique_name("Delete From Viewer"), [tag["id"]])
            navigate(page, f"/thoughts/{thought['id']}")
            expect(page.get_by_test_id("thought-viewer")).to_be_visible(timeout=5000)

            page.get_by_test_id("delete-thought-button").click()
            expect(page.get_by_test_id("delete-thought-dialog")).to_be_visible(timeout=5000)
            page.get_by_test_id("confirm-delete-thought").click()

            page.wait_for_url("**/thoughts", timeout=5000)
        finally:
            api.delete_tag(tag["id"])

    def test_edit_thought_from_viewer(self, page: Page, api: BrainBookAPI):
        tag = api.create_tag(unique_name("edit-tag"))
        try:
            thought = api.create_thought(unique_name("Before Edit"), [tag["id"]])
            try:
                navigate(page, f"/thoughts/{thought['id']}")
                expect(page.get_by_test_id("thought-viewer")).to_be_visible(timeout=5000)

                page.get_by_test_id("edit-thought-button").click()
                expect(page.get_by_test_id("thought-form-dialog")).to_be_visible(timeout=5000)

                name_input = page.get_by_test_id("thought-name-input")
                name_input.clear()
                name_input.fill("After Edit")
                page.get_by_test_id("thought-form-submit").click()

                expect(page.get_by_test_id("thought-form-dialog")).not_to_be_visible(timeout=5000)
                expect(page.get_by_text("After Edit")).to_be_visible(timeout=5000)
            finally:
                try:
                    api.delete_thought(thought["id"])
                except Exception:
                    pass
        finally:
            api.delete_tag(tag["id"])

    def test_neuron_viewer_shows_matching_neurons(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        tag = api.create_tag(unique_name("viewer-tag"))
        try:
            n1 = api.create_neuron(unique_name("Viewer N1"), brain["id"], cluster["id"])
            n2 = api.create_neuron(unique_name("Viewer N2"), brain["id"], cluster["id"])
            api.add_tag_to_neuron(n1["id"], tag["id"])
            api.add_tag_to_neuron(n2["id"], tag["id"])

            thought = api.create_thought(unique_name("Viewer Thought"), [tag["id"]])
            try:
                navigate(page, f"/thoughts/{thought['id']}")
                expect(page.get_by_test_id("neuron-navigator")).to_be_visible(timeout=5000)
                expect(page.get_by_test_id("neuron-content")).to_be_visible(timeout=5000)
                expect(page.get_by_text("Neuron 1 of 2")).to_be_visible(timeout=5000)
            finally:
                api.delete_thought(thought["id"])
        finally:
            api.delete_tag(tag["id"])

    def test_neuron_viewer_navigation(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        tag = api.create_tag(unique_name("nav-tag"))
        try:
            n1 = api.create_neuron(unique_name("Nav N1"), brain["id"], cluster["id"])
            n2 = api.create_neuron(unique_name("Nav N2"), brain["id"], cluster["id"])
            api.add_tag_to_neuron(n1["id"], tag["id"])
            api.add_tag_to_neuron(n2["id"], tag["id"])

            thought = api.create_thought(unique_name("Nav Thought"), [tag["id"]])
            try:
                navigate(page, f"/thoughts/{thought['id']}")
                expect(page.get_by_text("Neuron 1 of 2")).to_be_visible(timeout=5000)

                # Prev should be disabled on first neuron
                expect(page.get_by_test_id("prev-neuron")).to_be_disabled()

                # Navigate forward
                page.get_by_test_id("next-neuron").click()
                expect(page.get_by_text("Neuron 2 of 2")).to_be_visible(timeout=5000)

                # Next should be disabled on last neuron
                expect(page.get_by_test_id("next-neuron")).to_be_disabled()

                # Navigate back
                page.get_by_test_id("prev-neuron").click()
                expect(page.get_by_text("Neuron 1 of 2")).to_be_visible(timeout=5000)
            finally:
                api.delete_thought(thought["id"])
        finally:
            api.delete_tag(tag["id"])

    def test_empty_thought_no_neurons(self, page: Page, api: BrainBookAPI):
        tag = api.create_tag(unique_name("empty-tag"))
        try:
            thought = api.create_thought(unique_name("Empty Thought"), [tag["id"]])
            try:
                navigate(page, f"/thoughts/{thought['id']}")
                expect(page.get_by_test_id("thought-viewer")).to_be_visible(timeout=5000)
                expect(page.get_by_text("No neurons match")).to_be_visible(timeout=5000)
            finally:
                api.delete_thought(thought["id"])
        finally:
            api.delete_tag(tag["id"])
