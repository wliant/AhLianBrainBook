"""E2E tests for dark mode theme toggle."""

import os

import pytest
from playwright.sync_api import Page, expect

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")


class TestDarkModeToggle:
    def test_theme_toggle_visible_in_sidebar(self, home: Page):
        page = home
        expect(page.get_by_role("button", name="Theme")).to_be_visible()

    def test_switch_to_dark_mode(self, home: Page):
        page = home

        # Click Theme toggle
        page.get_by_role("button", name="Theme").click()
        page.wait_for_timeout(300)

        # Click Dark option
        page.get_by_text("Dark").click()
        page.wait_for_timeout(500)

        # Verify html has dark class
        html_class = page.locator("html").get_attribute("class")
        assert "dark" in (html_class or "")

    def test_switch_to_light_mode(self, home: Page):
        page = home

        page.get_by_role("button", name="Theme").click()
        page.wait_for_timeout(300)
        page.get_by_text("Light").click()
        page.wait_for_timeout(500)

        html_class = page.locator("html").get_attribute("class")
        assert "dark" not in (html_class or "")

    def test_switch_to_system_mode(self, home: Page):
        page = home

        page.get_by_role("button", name="Theme").click()
        page.wait_for_timeout(300)
        page.get_by_text("System").click()
        page.wait_for_timeout(500)

        # System mode should work without errors
        # (actual theme depends on OS preference)
        expect(page.locator("body")).to_be_visible()

    def test_dark_mode_persists_after_reload(self, home: Page):
        page = home

        # Set to dark
        page.get_by_role("button", name="Theme").click()
        page.wait_for_timeout(300)
        page.get_by_text("Dark").click()
        page.wait_for_timeout(500)

        # Reload
        page.reload()
        page.wait_for_load_state("networkidle")

        html_class = page.locator("html").get_attribute("class")
        assert "dark" in (html_class or "")

        # Reset to light for other tests
        page.get_by_role("button", name="Theme").click()
        page.wait_for_timeout(300)
        page.get_by_text("Light").click()

    def test_dark_mode_on_editor_page(self, home: Page, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        page = home

        # Set dark mode
        page.get_by_role("button", name="Theme").click()
        page.wait_for_timeout(300)
        page.get_by_text("Dark").click()
        page.wait_for_timeout(500)

        # Navigate to editor
        page.goto(f"{BASE_URL}/brain/{brain['id']}/cluster/{cluster['id']}/neuron/{neuron['id']}")
        page.wait_for_load_state("networkidle")

        html_class = page.locator("html").get_attribute("class")
        assert "dark" in (html_class or "")

        # Editor should be visible
        expect(page.get_by_placeholder("Untitled")).to_be_visible()
        expect(page.locator(".ProseMirror")).to_be_visible()

        # Reset
        page.get_by_role("button", name="Theme").click()
        page.wait_for_timeout(300)
        page.get_by_text("Light").click()
