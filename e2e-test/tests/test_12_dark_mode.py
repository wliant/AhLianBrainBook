"""E2E tests for dark mode theme toggle."""

import pytest
from playwright.sync_api import Page, expect

from helpers.page_helpers import navigate_to_neuron, set_theme


@pytest.fixture(autouse=True)
def reset_theme_after(home: Page):
    """Reset theme to light after each test to prevent state leaks."""
    yield
    try:
        set_theme(home, "light")
    except Exception:
        pass


class TestDarkModeToggle:
    def test_theme_toggle_visible_in_sidebar(self, home: Page):
        expect(home.get_by_test_id("theme-toggle")).to_be_visible()

    def test_switch_to_dark_mode(self, home: Page):
        set_theme(home, "dark")
        html_class = home.locator("html").get_attribute("class")
        assert "dark" in (html_class or "")

    def test_switch_to_light_mode(self, home: Page):
        set_theme(home, "dark")
        set_theme(home, "light")
        html_class = home.locator("html").get_attribute("class")
        assert "dark" not in (html_class or "")

    def test_switch_to_system_mode(self, home: Page):
        set_theme(home, "system")
        expect(home.locator("body")).to_be_visible()

    def test_dark_mode_persists_after_reload(self, home: Page):
        set_theme(home, "dark")

        home.reload()
        home.wait_for_load_state("networkidle")

        html_class = home.locator("html").get_attribute("class")
        assert "dark" in (html_class or "")

    def test_dark_mode_on_editor_page(self, home: Page, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        set_theme(home, "dark")

        navigate_to_neuron(home, brain["id"], cluster["id"], neuron["id"])

        html_class = home.locator("html").get_attribute("class")
        assert "dark" in (html_class or "")

        expect(home.get_by_test_id("neuron-title-input")).to_be_visible()
