"""E2E tests for keyboard shortcuts."""

import pytest
from playwright.sync_api import Page, expect

from helpers.page_helpers import navigate, navigate_to_neuron, unique_name
from helpers.api_client import BrainBookAPI


class TestKeyboardShortcuts:
    def test_question_mark_opens_shortcuts_dialog(self, home: Page):
        home.keyboard.press("?")
        expect(home.get_by_text("Keyboard Shortcuts")).to_be_visible(timeout=5000)

    def test_escape_closes_dialog(self, home: Page):
        home.keyboard.press("?")
        expect(home.get_by_text("Keyboard Shortcuts")).to_be_visible(timeout=5000)
        home.keyboard.press("Escape")
        expect(home.get_by_text("Keyboard Shortcuts")).not_to_be_visible(timeout=3000)

    def test_ctrl_k_opens_search(self, home: Page):
        home.keyboard.press("Control+k")
        expect(home).to_have_url(lambda url: "/search" in url, timeout=5000)

    def test_ctrl_b_applies_bold_in_editor(self, neuron_on_page):
        pg, brain, cluster, neuron = neuron_on_page
        editor = pg.locator(".ProseMirror")
        expect(editor).to_be_visible(timeout=5000)

        editor.click()
        editor.type("bold test")
        pg.keyboard.press("Control+a")
        pg.keyboard.press("Control+b")

        expect(editor.locator("strong")).to_be_visible(timeout=3000)

    def test_ctrl_z_undoes_in_editor(self, neuron_on_page):
        pg, brain, cluster, neuron = neuron_on_page
        editor = pg.locator(".ProseMirror")
        expect(editor).to_be_visible(timeout=5000)

        editor.click()
        editor.type("undo test")
        pg.keyboard.press("Control+z")

        # After undo, the typed text should be partially or fully removed
        expect(editor).not_to_have_text("undo test", timeout=3000)
