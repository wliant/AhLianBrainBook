"""E2E tests for AI section authoring assistant."""

import json

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate_to_neuron, unique_name, wait_for_save


@pytest.fixture
def neuron_with_code_section(api: BrainBookAPI):
    """Create a brain > cluster > neuron with a code section."""
    brain = api.create_brain(unique_name("ai-brain"))
    cluster = api.create_cluster(unique_name("ai-cluster"), brain["id"])
    neuron = api.create_neuron(
        unique_name("ai-neuron"), brain["id"], cluster["id"]
    )
    content = {
        "version": 2,
        "sections": [
            {
                "id": "s1",
                "type": "code",
                "order": 0,
                "content": {"code": "# placeholder", "language": "python"},
                "meta": {},
            }
        ],
    }
    api.update_neuron_content(
        neuron["id"],
        json.dumps(content),
        "placeholder",
        neuron["version"],
    )
    yield {"brain": brain, "cluster": cluster, "neuron": neuron}
    try:
        api.delete_brain(brain["id"])
    except Exception:
        pass


@pytest.fixture
def neuron_with_image_section(api: BrainBookAPI):
    """Create a neuron with an image section (unsupported for AI assist)."""
    brain = api.create_brain(unique_name("ai-img-brain"))
    cluster = api.create_cluster(unique_name("ai-img-cluster"), brain["id"])
    neuron = api.create_neuron(
        unique_name("ai-img-neuron"), brain["id"], cluster["id"]
    )
    content = {
        "version": 2,
        "sections": [
            {
                "id": "s1",
                "type": "image",
                "order": 0,
                "content": {"src": "", "caption": "", "sourceType": "url"},
                "meta": {},
            }
        ],
    }
    api.update_neuron_content(
        neuron["id"],
        json.dumps(content),
        "",
        neuron["version"],
    )
    yield {"brain": brain, "cluster": cluster, "neuron": neuron}
    try:
        api.delete_brain(brain["id"])
    except Exception:
        pass


@pytest.mark.browser
def test_ai_assist_dialog_opens(
    page: Page, neuron_with_code_section: dict
):
    """Clicking the AI assist button opens the dialog."""
    data = neuron_with_code_section
    navigate_to_neuron(
        page,
        data["brain"]["id"],
        data["cluster"]["id"],
        data["neuron"]["id"],
    )
    page.wait_for_load_state("networkidle")

    # Hover over the section to reveal toolbar
    section = page.locator("[data-section-id='s1']")
    section.hover()

    # Click AI assist button
    ai_btn = page.get_by_test_id("ai-assist-btn")
    expect(ai_btn).to_be_visible(timeout=5000)
    ai_btn.click()

    # Dialog should be visible
    dialog = page.get_by_test_id("ai-assist-dialog")
    expect(dialog).to_be_visible(timeout=5000)

    # Verify preview and chat panels exist
    expect(page.get_by_test_id("ai-assist-preview")).to_be_visible()
    expect(page.get_by_test_id("ai-assist-chat")).to_be_visible()
    expect(page.get_by_test_id("ai-assist-input")).to_be_visible()


@pytest.mark.browser
def test_ai_assist_close_discards(
    page: Page, neuron_with_code_section: dict, api: BrainBookAPI
):
    """Closing the dialog discards changes — section content stays the same."""
    data = neuron_with_code_section
    navigate_to_neuron(
        page,
        data["brain"]["id"],
        data["cluster"]["id"],
        data["neuron"]["id"],
    )
    page.wait_for_load_state("networkidle")

    section = page.locator("[data-section-id='s1']")
    section.hover()
    page.get_by_test_id("ai-assist-btn").click()
    expect(page.get_by_test_id("ai-assist-dialog")).to_be_visible(timeout=5000)

    # Close the dialog
    page.get_by_test_id("ai-assist-close").click()
    expect(page.get_by_test_id("ai-assist-dialog")).not_to_be_visible(timeout=5000)

    # Verify content unchanged via API
    neuron = api.get_neuron(data["neuron"]["id"])
    content = json.loads(neuron["contentJson"])
    assert content["sections"][0]["content"]["code"] == "# placeholder"


@pytest.mark.browser
def test_ai_assist_chat_interaction(
    page: Page, neuron_with_code_section: dict
):
    """User can type a message and the chat interface responds."""
    data = neuron_with_code_section
    navigate_to_neuron(
        page,
        data["brain"]["id"],
        data["cluster"]["id"],
        data["neuron"]["id"],
    )
    page.wait_for_load_state("networkidle")

    section = page.locator("[data-section-id='s1']")
    section.hover()
    page.get_by_test_id("ai-assist-btn").click()
    expect(page.get_by_test_id("ai-assist-dialog")).to_be_visible(timeout=5000)

    # Type a message
    input_el = page.get_by_test_id("ai-assist-input")
    input_el.fill("Write a fibonacci function in python")
    page.get_by_test_id("ai-assist-send").click()

    # Should show loading state
    loading = page.get_by_test_id("ai-assist-loading")
    # Wait for either loading to appear or response to arrive
    # The LLM may respond quickly or slowly
    try:
        loading.wait_for(state="visible", timeout=3000)
    except Exception:
        pass  # Loading may have already finished

    # Wait for response — either questions form or content in chat
    # Give Ollama up to 120s to respond
    page.wait_for_timeout(2000)  # Brief wait for response
    chat = page.get_by_test_id("ai-assist-chat")
    # At minimum, loading should eventually disappear
    expect(loading).not_to_be_visible(timeout=120000)


@pytest.mark.browser
def test_ai_assist_button_hidden_for_unsupported(
    page: Page, neuron_with_image_section: dict
):
    """AI assist button should not appear for image sections."""
    data = neuron_with_image_section
    navigate_to_neuron(
        page,
        data["brain"]["id"],
        data["cluster"]["id"],
        data["neuron"]["id"],
    )
    page.wait_for_load_state("networkidle")

    section = page.locator("[data-section-id='s1']")
    section.hover()
    page.wait_for_timeout(500)

    # AI assist button should NOT be present
    ai_btn = page.get_by_test_id("ai-assist-btn")
    expect(ai_btn).not_to_be_visible()
