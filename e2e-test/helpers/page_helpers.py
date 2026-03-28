"""Shared page interaction helpers for BrainBook E2E tests."""

import os

from playwright.sync_api import Page

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")


def navigate(page: Page, path: str):
    """Navigate to a path using page.goto for reliable Next.js routing."""
    url = f"{BASE_URL}{path}" if path.startswith("/") else path
    page.goto(url)
    page.wait_for_load_state("networkidle")
