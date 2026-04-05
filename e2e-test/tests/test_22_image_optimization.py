"""E2E tests for image optimization (lazy loading attributes)."""

import json

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate_to_neuron

from playwright.sync_api import expect

# Tiny 1x1 pixel PNG as data URL — no network required
_DATA_IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


class TestImageLazyLoading:
    def test_image_section_has_lazy_loading_attributes(self, api: BrainBookAPI, neuron_in_cluster, page):
        """Verify that image sections render with loading=lazy and decoding=async."""
        brain, cluster, neuron = neuron_in_cluster

        # Set neuron content with an image section
        content = json.dumps({
            "version": 2,
            "sections": [
                {
                    "id": "img-section-1",
                    "type": "image",
                    "order": 0,
                    "content": {
                        "src": _DATA_IMG,
                        "caption": "Test lazy image",
                        "sourceType": "url",
                    },
                    "meta": {},
                }
            ],
        })
        api.update_neuron_content(neuron["id"], content, "Image test", neuron["version"])

        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        # Find the image in the image section
        img = page.locator("img[alt='Test lazy image']")
        img.wait_for(state="attached", timeout=15000)

        assert img.get_attribute("loading") == "lazy"
        assert img.get_attribute("decoding") == "async"

    def test_image_section_renders_caption(self, api: BrainBookAPI, neuron_in_cluster, page):
        """Verify that image captions are rendered."""
        brain, cluster, neuron = neuron_in_cluster

        # Re-fetch neuron to get current version
        fresh_neuron = api.get_neuron(neuron["id"])

        content = json.dumps({
            "version": 2,
            "sections": [
                {
                    "id": "img-section-2",
                    "type": "image",
                    "order": 0,
                    "content": {
                        "src": _DATA_IMG,
                        "caption": "My test caption",
                        "sourceType": "url",
                    },
                    "meta": {},
                }
            ],
        })
        api.update_neuron_content(neuron["id"], content, "Caption test", fresh_neuron["version"])

        navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])

        # In edit mode, the caption is shown as an input field
        caption_input = page.get_by_placeholder("Add a caption...")
        caption_input.wait_for(state="visible", timeout=15000)
        assert caption_input.input_value() == "My test caption"
