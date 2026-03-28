"""E2E tests for Template CRUD via API."""

import json

import pytest

from helpers.api_client import BrainBookAPI


class TestTemplateCRUD:
    def test_create_template(self, api: BrainBookAPI):
        content = json.dumps({"type": "doc", "content": [{"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Title"}]}]})
        template = api.create_template("Meeting Notes", content, description="Template for meeting notes")

        try:
            assert template["name"] == "Meeting Notes"
            assert template["description"] == "Template for meeting notes"
            assert template["contentJson"] is not None
        finally:
            api.delete_template(template["id"])

    def test_list_templates(self, api: BrainBookAPI):
        content = json.dumps({"type": "doc"})
        t1 = api.create_template("Template Alpha", content)
        t2 = api.create_template("Template Beta", content)

        try:
            templates = api.list_templates()
            ids = [t["id"] for t in templates]
            assert t1["id"] in ids
            assert t2["id"] in ids
        finally:
            api.delete_template(t1["id"])
            api.delete_template(t2["id"])

    def test_get_template(self, api: BrainBookAPI):
        content = json.dumps({"type": "doc", "content": []})
        template = api.create_template("Get Test", content, description="Desc")

        try:
            fetched = api.get_template(template["id"])
            assert fetched["name"] == "Get Test"
            assert fetched["description"] == "Desc"
        finally:
            api.delete_template(template["id"])

    def test_update_template(self, api: BrainBookAPI):
        content = json.dumps({"type": "doc"})
        template = api.create_template("Update Me", content)

        try:
            new_content = json.dumps({"type": "doc", "content": [{"type": "paragraph"}]})
            updated = api.update_template(
                template["id"],
                name="Updated Template",
                description="New description",
                contentJson=new_content,
            )
            assert updated["name"] == "Updated Template"
            assert updated["description"] == "New description"
        finally:
            api.delete_template(template["id"])

    def test_delete_template(self, api: BrainBookAPI):
        content = json.dumps({"type": "doc"})
        template = api.create_template("Delete Me", content)

        api.delete_template(template["id"])

        templates = api.list_templates()
        assert not any(t["id"] == template["id"] for t in templates)
