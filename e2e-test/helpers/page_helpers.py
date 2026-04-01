"""Shared page interaction helpers for BrainBook E2E tests."""

import os
import time

from playwright.sync_api import Page, expect

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")


def unique_name(prefix: str) -> str:
    """Generate a unique name with random suffix to avoid collisions."""
    return f"{prefix} {os.urandom(4).hex()}"


def navigate(page: Page, path: str):
    """Navigate to a path using page.goto for reliable Next.js routing."""
    url = f"{BASE_URL}{path}" if path.startswith("/") else path
    page.goto(url)
    page.wait_for_load_state("networkidle")


def navigate_to_brain(page: Page, brain_id: str):
    """Navigate to a brain page."""
    navigate(page, f"/brain/{brain_id}")


def navigate_to_cluster(page: Page, brain_id: str, cluster_id: str):
    """Navigate to a cluster page."""
    navigate(page, f"/brain/{brain_id}/cluster/{cluster_id}")


def navigate_to_neuron(page: Page, brain_id: str, cluster_id: str, neuron_id: str):
    """Navigate to a neuron editor page."""
    navigate(page, f"/brain/{brain_id}/cluster/{cluster_id}/neuron/{neuron_id}")


def set_theme(page: Page, theme: str):
    """Set the theme (light/dark/system) via the theme toggle dropdown."""
    page.get_by_test_id("theme-toggle").click()
    expect(page.get_by_test_id(f"theme-{theme}")).to_be_visible(timeout=3000)
    page.get_by_test_id(f"theme-{theme}").click()
    # Wait for theme transition
    if theme == "dark":
        expect(page.locator("html.dark")).to_be_attached(timeout=3000)
    elif theme == "light":
        expect(page.locator("html:not(.dark)")).to_be_attached(timeout=3000)


def wait_for_save(page: Page, timeout: int = 10000):
    """Wait for the save status to show 'Saved' after an autosave."""
    expect(page.get_by_text("Saved")).to_be_visible(timeout=timeout)


def expand_brain_in_sidebar(page: Page, brain_id: str):
    """Expand a brain's tree in the sidebar using data-testid."""
    toggle = page.get_by_test_id(f"sidebar-brain-toggle-{brain_id}")
    toggle.click()
    # Wait for the expanded content to appear
    page.wait_for_timeout(300)


def expand_cluster_in_sidebar(page: Page, cluster_id: str):
    """Expand a cluster's tree in the sidebar using data-testid."""
    toggle = page.get_by_test_id(f"sidebar-cluster-toggle-{cluster_id}")
    toggle.click()
    page.wait_for_timeout(300)


def open_connections_panel(page: Page):
    """Click the connections toggle button on a neuron page."""
    page.get_by_test_id("toggle-connections").click()
    expect(page.get_by_test_id("connections-panel")).to_be_visible(timeout=5000)


def open_history_panel(page: Page):
    """Click the history toggle button on a neuron page."""
    page.get_by_test_id("toggle-history").click()
    expect(page.get_by_test_id("history-panel")).to_be_visible(timeout=5000)


def open_sr_panel(page: Page):
    """Click the spaced repetition toggle button on a neuron page."""
    page.get_by_test_id("toggle-sr").click()
    expect(page.get_by_test_id("sr-panel")).to_be_visible(timeout=5000)


def wait_for_search_index(api, query: str, expected_count: int = 1, timeout: int = 10):
    """Poll the search API until results appear, replacing time.sleep."""
    for _ in range(timeout * 2):
        result = api.search(query)
        if result.get("totalCount", 0) >= expected_count:
            return result
        time.sleep(0.5)
    raise TimeoutError(f"Search for '{query}' didn't find {expected_count} results within {timeout}s")
