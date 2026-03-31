"""E2E tests for code section with CodeMirror editor."""

import json

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate_to_neuron

from playwright.sync_api import expect


class TestCodeSectionRendering:
    def test_code_section_renders_with_codemirror(self, api: BrainBookAPI, neuron_in_cluster, page):
        """Verify that code sections render using CodeMirror editor."""
        brain, cluster, neuron = neuron_in_cluster

        content = json.dumps({
            "version": 2,
            "sections": [
                {
                    "id": "code-section-1",
                    "type": "code",
                    "order": 0,
                    "content": {
                        "code": "console.log('hello world');",
                        "language": "javascript",
                        "title": "Test Code",
                    },
                    "meta": {},
                }
            ],
        })
        api.update_neuron_content(neuron["id"], content, "Code test", neuron["version"])

        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        # Verify CodeMirror editor is present (identified by .cm-editor class)
        cm_editor = page.locator("[data-testid='codemirror-editor'] .cm-editor")
        cm_editor.wait_for(state="attached", timeout=10000)

        # Verify code content is displayed
        cm_content = page.locator(".cm-content")
        expect(cm_content).to_contain_text("console.log")

    def test_code_section_language_selector(self, api: BrainBookAPI, neuron_in_cluster, page):
        """Verify that language selector works in code sections."""
        brain, cluster, neuron = neuron_in_cluster

        content = json.dumps({
            "version": 2,
            "sections": [
                {
                    "id": "code-section-2",
                    "type": "code",
                    "order": 0,
                    "content": {
                        "code": "def hello(): pass",
                        "language": "python",
                        "title": "",
                    },
                    "meta": {},
                }
            ],
        })
        api.update_neuron_content(neuron["id"], content, "Lang test", neuron["version"])

        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        # Verify python is selected
        select = page.locator("select")
        select.wait_for(state="visible", timeout=10000)
        assert select.input_value() == "python"

    def test_code_section_run_button_for_javascript(self, api: BrainBookAPI, neuron_in_cluster, page):
        """Verify Run button appears for JavaScript code sections."""
        brain, cluster, neuron = neuron_in_cluster

        content = json.dumps({
            "version": 2,
            "sections": [
                {
                    "id": "code-section-3",
                    "type": "code",
                    "order": 0,
                    "content": {
                        "code": "console.log(1 + 1);",
                        "language": "javascript",
                        "title": "",
                    },
                    "meta": {},
                }
            ],
        })
        api.update_neuron_content(neuron["id"], content, "Run test", neuron["version"])

        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        run_btn = page.get_by_test_id("run-code-btn")
        run_btn.wait_for(state="visible", timeout=10000)
        expect(run_btn).to_be_visible()

    def test_code_section_view_mode(self, api: BrainBookAPI, neuron_in_cluster, page):
        """Verify code sections render in view mode (no language selector)."""
        brain, cluster, neuron = neuron_in_cluster

        content = json.dumps({
            "version": 2,
            "sections": [
                {
                    "id": "code-section-4",
                    "type": "code",
                    "order": 0,
                    "content": {
                        "code": "fn main() {}",
                        "language": "rust",
                        "title": "",
                    },
                    "meta": {},
                }
            ],
        })
        api.update_neuron_content(neuron["id"], content, "View test", neuron["version"])

        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        # Code should be visible
        cm_content = page.locator(".cm-content")
        cm_content.wait_for(state="attached", timeout=10000)
        expect(cm_content).to_contain_text("fn main()")
