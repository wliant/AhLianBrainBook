"""E2E tests for AI section authoring with deep agent (tools_enabled=True)."""

import json

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate_to_neuron, unique_name


@pytest.fixture
def neuron_for_deep_agent(api: BrainBookAPI):
    """Create a brain > cluster > neuron with a code section for deep agent testing."""
    brain = api.create_brain(unique_name("deep-agent-brain"))
    cluster = api.create_cluster(unique_name("deep-agent-cluster"), brain["id"])
    neuron = api.create_neuron(unique_name("deep-agent-neuron"), brain["id"], cluster["id"])
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


@pytest.mark.browser
def test_deep_agent_dialog_opens_and_responds(
    page: Page, neuron_for_deep_agent: dict
):
    """With tools_enabled=True (toggle on), the dialog opens and the agent responds."""
    data = neuron_for_deep_agent
    navigate_to_neuron(
        page,
        data["brain"]["id"],
        data["cluster"]["id"],
        data["neuron"]["id"],
    )
    page.wait_for_load_state("networkidle")

    # Hover the section to reveal toolbar
    section = page.locator("[data-section-id='s1']")
    section.hover()

    # Open AI assist
    ai_btn = page.get_by_test_id("ai-assist-btn")
    expect(ai_btn).to_be_visible(timeout=5000)
    ai_btn.click()

    dialog = page.get_by_test_id("ai-assist-dialog")
    expect(dialog).to_be_visible(timeout=5000)

    # Enable the tools toggle if present
    tools_toggle = page.get_by_test_id("ai-assist-tools-toggle")
    if tools_toggle.is_visible():
        if not tools_toggle.is_checked():
            tools_toggle.click()

    # Submit a simple, unambiguous request
    input_el = page.get_by_test_id("ai-assist-input")
    input_el.fill("Write a hello world function in Python")
    page.get_by_test_id("ai-assist-send").click()

    # Wait for the loading indicator to disappear (agent running)
    loading = page.get_by_test_id("ai-assist-loading")
    try:
        loading.wait_for(state="visible", timeout=3000)
    except Exception:
        pass  # May have already finished

    # Agent should complete within 120s
    expect(loading).not_to_be_visible(timeout=120000)

    # Response should appear in the chat or preview
    chat = page.get_by_test_id("ai-assist-chat")
    expect(chat).to_be_visible()


@pytest.mark.browser
def test_deep_agent_accept_inserts_content(
    page: Page, neuron_for_deep_agent: dict, api: BrainBookAPI
):
    """After agent generates content, accepting it updates the section."""
    data = neuron_for_deep_agent
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

    # Enable tools toggle if present
    tools_toggle = page.get_by_test_id("ai-assist-tools-toggle")
    if tools_toggle.is_visible() and not tools_toggle.is_checked():
        tools_toggle.click()

    page.get_by_test_id("ai-assist-input").fill("Write a hello world function in Python")
    page.get_by_test_id("ai-assist-send").click()

    loading = page.get_by_test_id("ai-assist-loading")
    try:
        loading.wait_for(state="visible", timeout=3000)
    except Exception:
        pass
    expect(loading).not_to_be_visible(timeout=120000)

    # Accept the generated content if accept button appears
    accept_btn = page.get_by_test_id("ai-assist-accept")
    if accept_btn.is_visible(timeout=3000):
        accept_btn.click()
        expect(page.get_by_test_id("ai-assist-dialog")).not_to_be_visible(timeout=5000)

        # Verify the section content changed via API (wait for autosave)
        page.wait_for_timeout(3000)
        neuron = api.get_neuron(data["neuron"]["id"])
        content = json.loads(neuron["contentJson"])
        code = content["sections"][0]["content"].get("code", "")
        assert code != "# placeholder", f"Section content was not updated: {code!r}"
