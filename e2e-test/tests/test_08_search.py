"""E2E tests for full-text search via browser and API."""

import json
import os
import time

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")


class TestSearchViaBrowser:
    def test_search_page_loads(self, home: Page):
        page = home
        page.goto(f"{BASE_URL}/search")
        page.wait_for_load_state("networkidle")

        assert "/search" in page.url
        expect(page.get_by_placeholder("Search neurons...")).to_be_visible()

    def test_search_finds_neuron_by_content(self, home: Page, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        unique_word = f"xylophone{os.urandom(4).hex()}"
        content = json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Playing the {unique_word} loudly"}]}]})
        neuron = api.create_neuron(
            "Searchable Note",
            brain["id"],
            cluster["id"],
            contentJson=content,
            contentText=f"Playing the {unique_word} loudly",
        )

        try:
            time.sleep(1)

            page = home
            page.goto(f"{BASE_URL}/search")
            page.wait_for_load_state("networkidle")

            search_input = page.get_by_placeholder("Search neurons...")
            search_input.fill(unique_word)
            search_input.press("Enter")

            page.wait_for_timeout(2000)
            expect(page.get_by_text("Searchable Note")).to_be_visible()
        finally:
            api.permanent_delete_neuron(neuron["id"])

    def test_search_no_results(self, home: Page):
        page = home
        page.goto(f"{BASE_URL}/search")
        page.wait_for_load_state("networkidle")

        search_input = page.get_by_placeholder("Search neurons...")
        search_input.fill("zzznonexistent999")
        search_input.press("Enter")

        page.wait_for_timeout(1000)
        expect(page.get_by_text("No results found")).to_be_visible()


class TestSearchViaAPI:
    def test_search_with_brain_filter(self, api: BrainBookAPI, brain_with_cluster):
        brain, cluster = brain_with_cluster
        unique = f"filterable{os.urandom(4).hex()}"
        neuron = api.create_neuron(
            "Filtered Search",
            brain["id"],
            cluster["id"],
            contentText=unique,
        )

        try:
            time.sleep(1)
            result = api.search(unique, brain_id=brain["id"])
            assert result["totalCount"] >= 1
            assert any(n["id"] == neuron["id"] for n in result["results"])
        finally:
            api.permanent_delete_neuron(neuron["id"])

    def test_search_pagination(self, api: BrainBookAPI):
        result = api.search("test", page=0, size=5)
        assert "results" in result
        assert "totalCount" in result
        assert isinstance(result["results"], list)
