"""E2E tests for full-text search via browser and API."""

import json
import os

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate, wait_for_search_index, unique_name


class TestSearchViaBrowser:
    def test_search_page_loads(self, page: Page):
        navigate(page, "/search")
        assert "/search" in page.url
        expect(page.get_by_placeholder("Search neurons...")).to_be_visible()

    def test_search_finds_neuron_by_content(self, page: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        unique_word = f"xylophone{os.urandom(4).hex()}"
        content = json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Playing the {unique_word} loudly"}]}]})
        neuron = api.create_neuron(
            unique_name("Searchable Note"),
            brain["id"],
            cluster["id"],
            contentJson=content,
            contentText=f"Playing the {unique_word} loudly",
        )

        try:
            # Poll API until search index is ready instead of fixed sleep
            wait_for_search_index(api, unique_word, expected_count=1, timeout=10)

            navigate(page, "/search")
            search_input = page.get_by_placeholder("Search neurons...")
            search_input.fill(unique_word)
            search_input.press("Enter")

            expect(page.get_by_text(neuron["title"])).to_be_visible(timeout=10000)
        finally:
            api.permanent_delete_neuron(neuron["id"])

    def test_search_no_results(self, page: Page):
        navigate(page, "/search")
        search_input = page.get_by_placeholder("Search neurons...")
        search_input.fill("zzznonexistent999")
        search_input.press("Enter")

        expect(page.get_by_text("No results found")).to_be_visible(timeout=5000)


class TestSearchViaAPI:
    def test_search_with_brain_filter(self, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        unique = f"filterable{os.urandom(4).hex()}"
        neuron = api.create_neuron(
            unique_name("Filtered Search"),
            brain["id"],
            cluster["id"],
            contentText=unique,
        )

        try:
            result = wait_for_search_index(api, unique, expected_count=1, timeout=10)
            assert any(n["id"] == neuron["id"] for n in result["results"])
        finally:
            api.permanent_delete_neuron(neuron["id"])

    def test_search_pagination(self, api: BrainBookAPI):
        result = api.search("test", page=0, size=5)
        assert "results" in result
        assert "totalCount" in result
        assert isinstance(result["results"], list)
