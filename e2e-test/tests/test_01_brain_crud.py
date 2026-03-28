"""E2E tests for Brain CRUD operations via browser."""

import os

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")


@pytest.fixture
def cleanup_brains(api: BrainBookAPI):
    """Track and clean up brains created during tests."""
    created = []
    yield created
    for brain_id in created:
        try:
            api.delete_brain(brain_id)
        except Exception:
            pass


class TestBrainCreateViaBrowser:
    def test_create_brain_from_sidebar(self, home: Page, api: BrainBookAPI, cleanup_brains: list):
        page = home
        # The plus button is next to the "Brains" label
        brains_section = page.locator("text=Brains").locator("..")
        add_btn = brains_section.get_by_role("button")
        add_btn.click()

        # Dialog should appear with "New Brain" title
        expect(page.get_by_text("New Brain")).to_be_visible()

        brain_name = "Browser Created Brain"
        page.get_by_placeholder("Name...").fill(brain_name)
        page.get_by_role("button", name="Create").click()

        page.wait_for_timeout(500)
        expect(page.get_by_text(brain_name)).to_be_visible()

        # Verify via API
        brains = api.list_brains()
        created = [b for b in brains if b["name"] == brain_name]
        assert len(created) == 1
        cleanup_brains.append(created[0]["id"])

    def test_create_brain_via_enter_key(self, home: Page, api: BrainBookAPI, cleanup_brains: list):
        page = home
        brains_section = page.locator("text=Brains").locator("..")
        add_btn = brains_section.get_by_role("button")
        add_btn.click()

        brain_name = "Enter Key Brain"
        page.get_by_placeholder("Name...").fill(brain_name)
        page.get_by_placeholder("Name...").press("Enter")

        page.wait_for_timeout(500)
        expect(page.get_by_text(brain_name)).to_be_visible()

        brains = api.list_brains()
        created = [b for b in brains if b["name"] == brain_name]
        assert len(created) == 1
        cleanup_brains.append(created[0]["id"])


class TestBrainRenameViaBrowser:
    def test_rename_brain(self, home: Page, api: BrainBookAPI, cleanup_brains: list):
        page = home
        brain = api.create_brain("Brain To Rename")
        cleanup_brains.append(brain["id"])

        page.reload()
        page.wait_for_load_state("networkidle")

        # Find the brain item container in sidebar and hover to reveal menu
        brain_link = page.get_by_role("link", name="Brain To Rename")
        brain_container = brain_link.locator("..")
        brain_container.hover()

        # The more button is the last button in the brain item group (dropdown trigger)
        # It becomes visible on hover via group-hover:opacity-100
        more_btn = brain_container.locator("button").last
        more_btn.click(force=True)

        # Click Rename in dropdown
        page.get_by_role("menuitem", name="Rename").click()

        # Dialog with "Rename Brain" title
        expect(page.get_by_text("Rename Brain")).to_be_visible()
        name_input = page.get_by_placeholder("Name...")
        name_input.clear()
        name_input.fill("Renamed Brain")
        page.get_by_role("button", name="Save").click()

        page.wait_for_timeout(500)
        expect(page.get_by_text("Renamed Brain")).to_be_visible()

        # Verify via API
        updated = api.get_brain(brain["id"])
        assert updated["name"] == "Renamed Brain"


class TestBrainDeleteViaBrowser:
    def test_delete_brain(self, api: BrainBookAPI, page: Page):
        brain = api.create_brain("Brain To Delete")

        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")

        sidebar = page.locator("aside")
        brain_link = sidebar.locator(f"a[href='/brain/{brain['id']}']")
        expect(brain_link).to_be_visible()

        brain_row = brain_link.locator("..")
        brain_row.hover()
        page.wait_for_timeout(300)

        # The dropdown trigger button has opacity-0 by default, visible on hover
        more_btn = brain_row.locator("button:nth-child(3)")
        more_btn.click(force=True)
        page.wait_for_timeout(300)

        page.get_by_role("menuitem", name="Delete").click()

        page.wait_for_timeout(500)
        expect(brain_link).not_to_be_visible()

        brains = api.list_brains()
        assert not any(b["id"] == brain["id"] for b in brains)


class TestBrainArchiveViaAPI:
    def test_archive_and_restore_brain(self, api: BrainBookAPI):
        brain = api.create_brain("Archive Test Brain")
        try:
            archived = api.archive_brain(brain["id"])
            assert archived["isArchived"] is True

            brains = api.list_brains()
            assert not any(b["id"] == brain["id"] for b in brains)

            restored = api.restore_brain(brain["id"])
            assert restored["isArchived"] is False

            brains = api.list_brains()
            assert any(b["id"] == brain["id"] for b in brains)
        finally:
            api.delete_brain(brain["id"])


class TestBrainReorderViaAPI:
    def test_reorder_brains(self, api: BrainBookAPI):
        b1 = api.create_brain("Reorder A")
        b2 = api.create_brain("Reorder B")
        b3 = api.create_brain("Reorder C")
        try:
            api.reorder_brains([b3["id"], b1["id"], b2["id"]])

            brains = api.list_brains()
            reorder_brains = [b for b in brains if b["id"] in {b1["id"], b2["id"], b3["id"]}]
            reorder_brains.sort(key=lambda b: b["sortOrder"])

            assert reorder_brains[0]["id"] == b3["id"]
            assert reorder_brains[1]["id"] == b1["id"]
            assert reorder_brains[2]["id"] == b2["id"]
        finally:
            for b in [b1, b2, b3]:
                try:
                    api.delete_brain(b["id"])
                except Exception:
                    pass
