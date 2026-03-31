"""E2E tests for Brain CRUD operations via browser."""

import warnings

import pytest
from playwright.sync_api import Page, expect

from helpers.api_client import BrainBookAPI
from helpers.page_helpers import navigate, unique_name


@pytest.fixture
def cleanup_brains(api: BrainBookAPI):
    """Track and clean up brains created during tests."""
    created = []
    yield created
    for brain_id in created:
        try:
            api.delete_brain(brain_id)
        except Exception as e:
            warnings.warn(f"Cleanup failed for brain {brain_id}: {e}")


class TestBrainCreateViaBrowser:
    def test_create_brain_from_sidebar(self, home: Page, api: BrainBookAPI, cleanup_brains: list):
        page = home
        page.get_by_test_id("sidebar-create-brain-btn").click()

        # Dialog should appear with "New Brain" title
        expect(page.get_by_test_id("sidebar-dialog")).to_be_visible(timeout=5000)
        expect(page.get_by_text("New Brain")).to_be_visible(timeout=3000)

        brain_name = unique_name("Browser Created Brain")
        page.get_by_test_id("sidebar-dialog-input").fill(brain_name)
        page.get_by_test_id("sidebar-dialog-submit").click()

        expect(page.get_by_text(brain_name)).to_be_visible(timeout=5000)

        # Verify via API
        brains = api.list_brains()
        created = [b for b in brains if b["name"] == brain_name]
        assert len(created) == 1
        cleanup_brains.append(created[0]["id"])

    def test_create_brain_via_enter_key(self, home: Page, api: BrainBookAPI, cleanup_brains: list):
        page = home
        page.get_by_test_id("sidebar-create-brain-btn").click()

        brain_name = unique_name("Enter Key Brain")
        page.get_by_test_id("sidebar-dialog-input").fill(brain_name)
        page.get_by_test_id("sidebar-dialog-input").press("Enter")

        expect(page.get_by_text(brain_name)).to_be_visible(timeout=5000)

        brains = api.list_brains()
        created = [b for b in brains if b["name"] == brain_name]
        assert len(created) == 1
        cleanup_brains.append(created[0]["id"])


class TestBrainRenameViaBrowser:
    def test_rename_brain(self, home: Page, api: BrainBookAPI, cleanup_brains: list):
        page = home
        brain = api.create_brain(unique_name("Brain To Rename"))
        cleanup_brains.append(brain["id"])

        page.reload()
        page.wait_for_load_state("networkidle")

        # Open the brain context menu via data-testid
        menu_btn = page.get_by_test_id(f"sidebar-brain-menu-{brain['id']}")
        menu_btn.click(force=True)

        # Click Rename in dropdown
        page.get_by_test_id(f"sidebar-brain-rename-{brain['id']}").click()

        # Dialog with "Rename Brain" title
        expect(page.get_by_text("Rename Brain")).to_be_visible(timeout=5000)
        name_input = page.get_by_test_id("sidebar-dialog-input")
        name_input.clear()
        renamed = unique_name("Renamed Brain")
        name_input.fill(renamed)
        page.get_by_test_id("sidebar-dialog-submit").click()

        expect(page.get_by_text(renamed)).to_be_visible(timeout=5000)

        # Verify via API
        updated = api.get_brain(brain["id"])
        assert updated["name"] == renamed


class TestBrainDeleteViaBrowser:
    def test_delete_brain(self, api: BrainBookAPI, page: Page):
        brain = api.create_brain(unique_name("Brain To Delete"))

        navigate(page, "/")

        brain_item = page.get_by_test_id(f"sidebar-brain-{brain['id']}")
        expect(brain_item).to_be_visible(timeout=5000)

        # Open the brain context menu
        menu_btn = page.get_by_test_id(f"sidebar-brain-menu-{brain['id']}")
        menu_btn.click(force=True)

        page.get_by_test_id(f"sidebar-brain-delete-{brain['id']}").click()

        expect(brain_item).not_to_be_visible(timeout=5000)

        brains = api.list_brains()
        assert not any(b["id"] == brain["id"] for b in brains)


class TestBrainArchiveViaAPI:
    def test_archive_and_restore_brain(self, api: BrainBookAPI):
        brain = api.create_brain(unique_name("Archive Test Brain"))
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
        b1 = api.create_brain(unique_name("Reorder A"))
        b2 = api.create_brain(unique_name("Reorder B"))
        b3 = api.create_brain(unique_name("Reorder C"))
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
                except Exception as e:
                    warnings.warn(f"Cleanup failed for brain {b['id']}: {e}")
