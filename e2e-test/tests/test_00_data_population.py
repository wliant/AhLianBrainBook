"""Data population test — seeds the database with realistic content across all features."""

import json
from datetime import datetime, timedelta, timezone

import pytest

from helpers.api_client import BrainBookAPI


def future_iso(hours: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%S")


def _rich_text(text: str) -> dict:
    return {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}]}


_DATA_IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


class TestDataPopulation:
    """Populate the database with a realistic brain containing every cluster type,
    section type, and cross-cutting feature (links, reminders, reviews, thoughts)."""

    def test_populate(self, api: BrainBookAPI):
        # ── Brain ──
        brain = api.create_brain("Demo Notebook", icon="book", color="#6366f1")

        # ────────────────────────────────────────────
        # 1. Knowledge cluster with diverse section types
        # ────────────────────────────────────────────
        knowledge = api.create_cluster("Learning Notes", brain["id"])

        # Rich-text neuron
        n_richtext = api.create_neuron("Getting Started with Python", brain["id"], knowledge["id"])
        api.update_neuron_content(
            n_richtext["id"],
            json.dumps({
                "version": 2,
                "sections": [{
                    "id": "s-rt-1", "type": "rich-text", "order": 0,
                    "content": _rich_text("Python is a versatile language used for web development, data science, and automation."),
                    "meta": {},
                }],
            }),
            "Python is a versatile language used for web development, data science, and automation.",
            n_richtext["version"],
        )

        # Code neuron
        n_code = api.create_neuron("Useful Python Snippets", brain["id"], knowledge["id"])
        api.update_neuron_content(
            n_code["id"],
            json.dumps({
                "version": 2,
                "sections": [{
                    "id": "s-code-1", "type": "code", "order": 0,
                    "content": {"code": "def fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a", "language": "python", "title": "Fibonacci"},
                    "meta": {},
                }],
            }),
            "def fibonacci(n): ...",
            n_code["version"],
        )

        # Math neuron
        n_math = api.create_neuron("Euler's Identity", brain["id"], knowledge["id"])
        api.update_neuron_content(
            n_math["id"],
            json.dumps({
                "version": 2,
                "sections": [
                    {
                        "id": "s-rt-2", "type": "rich-text", "order": 0,
                        "content": _rich_text("One of the most beautiful equations in mathematics:"),
                        "meta": {},
                    },
                    {
                        "id": "s-math-1", "type": "math", "order": 1,
                        "content": {"latex": "e^{i\\pi} + 1 = 0", "displayMode": True},
                        "meta": {},
                    },
                ],
            }),
            "One of the most beautiful equations in mathematics: e^(i*pi) + 1 = 0",
            n_math["version"],
        )

        # Diagram neuron
        n_diagram = api.create_neuron("System Architecture", brain["id"], knowledge["id"])
        api.update_neuron_content(
            n_diagram["id"],
            json.dumps({
                "version": 2,
                "sections": [{
                    "id": "s-dia-1", "type": "diagram", "order": 0,
                    "content": {
                        "source": "graph LR\n  A[Client] --> B[API Gateway]\n  B --> C[Backend]\n  C --> D[(Database)]",
                        "diagramType": "mermaid",
                    },
                    "meta": {},
                }],
            }),
            "System architecture diagram",
            n_diagram["version"],
        )

        # Image neuron
        n_image = api.create_neuron("Architecture Snapshot", brain["id"], knowledge["id"])
        api.update_neuron_content(
            n_image["id"],
            json.dumps({
                "version": 2,
                "sections": [{
                    "id": "s-img-1", "type": "image", "order": 0,
                    "content": {"src": _DATA_IMG, "caption": "Placeholder architecture diagram", "sourceType": "url"},
                    "meta": {},
                }],
            }),
            "Architecture diagram",
            n_image["version"],
        )

        # Table neuron
        n_table = api.create_neuron("HTTP Status Codes", brain["id"], knowledge["id"])
        api.update_neuron_content(
            n_table["id"],
            json.dumps({
                "version": 2,
                "sections": [{
                    "id": "s-tbl-1", "type": "table", "order": 0,
                    "content": {
                        "headers": ["Code", "Meaning", "Category"],
                        "rows": [
                            ["200", "OK", "Success"],
                            ["301", "Moved Permanently", "Redirect"],
                            ["404", "Not Found", "Client Error"],
                            ["500", "Internal Server Error", "Server Error"],
                        ],
                    },
                    "meta": {},
                }],
            }),
            "HTTP status codes reference table",
            n_table["version"],
        )

        # Callout neuron
        n_callout = api.create_neuron("Important Reminders", brain["id"], knowledge["id"])
        api.update_neuron_content(
            n_callout["id"],
            json.dumps({
                "version": 2,
                "sections": [
                    {
                        "id": "s-call-1", "type": "callout", "order": 0,
                        "content": {"variant": "warning", "text": "Always back up your database before running migrations."},
                        "meta": {},
                    },
                    {
                        "id": "s-call-2", "type": "callout", "order": 1,
                        "content": {"variant": "info", "text": "Use environment variables for secrets — never commit them."},
                        "meta": {},
                    },
                    {
                        "id": "s-div-1", "type": "divider", "order": 2,
                        "content": {},
                        "meta": {},
                    },
                    {
                        "id": "s-call-3", "type": "callout", "order": 3,
                        "content": {"variant": "success", "text": "All tests passed!"},
                        "meta": {},
                    },
                ],
            }),
            "Database backup warning; env vars for secrets; tests passed",
            n_callout["version"],
        )

        # Multi-section neuron (rich-text + code + callout)
        n_multi = api.create_neuron("FastAPI Quick Start", brain["id"], knowledge["id"])
        api.update_neuron_content(
            n_multi["id"],
            json.dumps({
                "version": 2,
                "sections": [
                    {
                        "id": "s-rt-3", "type": "rich-text", "order": 0,
                        "content": _rich_text("A minimal FastAPI application in Python:"),
                        "meta": {},
                    },
                    {
                        "id": "s-code-2", "type": "code", "order": 1,
                        "content": {
                            "code": 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/")\ndef read_root():\n    return {"Hello": "World"}',
                            "language": "python",
                            "title": "main.py",
                        },
                        "meta": {},
                    },
                    {
                        "id": "s-call-4", "type": "callout", "order": 2,
                        "content": {"variant": "info", "text": "Run with: uvicorn main:app --reload"},
                        "meta": {},
                    },
                ],
            }),
            "A minimal FastAPI application in Python",
            n_multi["version"],
        )

        knowledge_neurons = [n_richtext, n_code, n_math, n_diagram, n_image, n_table, n_callout, n_multi]

        # ────────────────────────────────────────────
        # 2. AI Research cluster
        # ────────────────────────────────────────────
        ai_cluster = api.create_cluster("AI Research", brain["id"], cluster_type="ai-research")
        assert ai_cluster["type"] == "ai-research"

        # ────────────────────────────────────────────
        # 3. Todo cluster with task neurons
        # ────────────────────────────────────────────
        todo_cluster = api.create_cluster("Tasks", brain["id"], cluster_type="todo")
        assert todo_cluster["type"] == "todo"

        task_1 = api.create_neuron("Review PR #42", brain["id"], todo_cluster["id"])
        api.get_todo_metadata(task_1["id"])  # auto-creates metadata
        api.update_todo_metadata(task_1["id"], priority="important", effort="1hr", dueDate=str((datetime.now(timezone.utc) + timedelta(days=2)).date()))

        task_2 = api.create_neuron("Write unit tests for auth service", brain["id"], todo_cluster["id"])
        api.get_todo_metadata(task_2["id"])
        api.update_todo_metadata(task_2["id"], priority="critical", effort="4hr", dueDate=str((datetime.now(timezone.utc) + timedelta(days=1)).date()))

        task_3 = api.create_neuron("Update documentation", brain["id"], todo_cluster["id"])
        api.get_todo_metadata(task_3["id"])
        api.update_todo_metadata(task_3["id"], priority="normal", effort="30min")

        # ────────────────────────────────────────────
        # 4. Project clusters
        # ────────────────────────────────────────────
        proj_asset = api.create_cluster(
            "AssetForgeMCP", brain["id"],
            cluster_type="project",
            repo_url="https://github.com/wliant/AssetForgeMCP.git",
        )
        assert proj_asset["type"] == "project"

        proj_meeples = api.create_cluster(
            "MeeplesShelf", brain["id"],
            cluster_type="project",
            repo_url="https://github.com/wliant/MeeplesShelf.git",
        )
        assert proj_meeples["type"] == "project"

        # ────────────────────────────────────────────
        # 5. Tags and Thoughts
        # ────────────────────────────────────────────
        tag_python = api.find_or_create_tag("python")
        tag_algo = api.find_or_create_tag("algorithms")
        tag_infra = api.find_or_create_tag("infrastructure")
        tag_api = api.find_or_create_tag("api-design")
        tag_math = api.find_or_create_tag("mathematics")

        # Tag some neurons
        api.add_tag_to_neuron(n_richtext["id"], tag_python["id"])
        api.add_tag_to_neuron(n_code["id"], tag_python["id"])
        api.add_tag_to_neuron(n_code["id"], tag_algo["id"])
        api.add_tag_to_neuron(n_math["id"], tag_math["id"])
        api.add_tag_to_neuron(n_diagram["id"], tag_infra["id"])
        api.add_tag_to_neuron(n_table["id"], tag_api["id"])
        api.add_tag_to_neuron(n_multi["id"], tag_python["id"])
        api.add_tag_to_neuron(n_multi["id"], tag_api["id"])

        # Create multiple thoughts
        thought_py = api.create_thought(
            "Python Learning", [tag_python["id"]],
            neuron_tag_mode="any",
            description="All my Python-related notes",
        )

        thought_algo = api.create_thought(
            "Algorithm Reference", [tag_python["id"], tag_algo["id"]],
            neuron_tag_mode="all",
            description="Notes that cover both Python and algorithms",
        )

        thought_infra = api.create_thought(
            "Infrastructure Notes", [tag_infra["id"], tag_api["id"]],
            neuron_tag_mode="any",
            description="Architecture and API design notes",
        )

        # ────────────────────────────────────────────
        # 6. Neuron links
        # ────────────────────────────────────────────
        api.create_neuron_link(n_richtext["id"], n_code["id"], "related-to", label="Python basics → snippets")
        api.create_neuron_link(n_code["id"], n_multi["id"], "references", label="Code examples")
        api.create_neuron_link(n_diagram["id"], n_table["id"], "depends-on", label="Architecture references HTTP codes")
        api.create_neuron_link(n_multi["id"], n_callout["id"], "related-to", label="FastAPI tips")

        # ────────────────────────────────────────────
        # 7. Reminders
        # ────────────────────────────────────────────
        api.create_reminder(
            n_richtext["id"], future_iso(24), "ONCE",
            title="Review Python basics",
        )
        api.create_reminder(
            n_code["id"], future_iso(48), "RECURRING",
            title="Practice coding snippets",
            recurrencePattern="WEEKLY",
            recurrenceInterval=1,
        )
        api.create_reminder(
            n_multi["id"], future_iso(72), "ONCE",
            title="Try FastAPI tutorial",
            description='{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Follow the quick start guide"}]}]}',
            descriptionText="Follow the quick start guide",
        )

        # ────────────────────────────────────────────
        # 8. Spaced repetition
        # ────────────────────────────────────────────
        sr_richtext = api.add_sr_item(n_richtext["id"])
        sr_code = api.add_sr_item(n_code["id"])
        sr_math = api.add_sr_item(n_math["id"])
        sr_table = api.add_sr_item(n_table["id"])

        # Submit a review for one item to advance its state
        api.submit_sr_review(sr_richtext["id"], 4)

        # ────────────────────────────────────────────
        # 9. Favorites and pins
        # ────────────────────────────────────────────
        api.toggle_favorite(n_richtext["id"])
        api.toggle_favorite(n_multi["id"])
        api.toggle_pin(n_code["id"])
        api.toggle_pin(n_table["id"])

        # ────────────────────────────────────────────
        # Verification
        # ────────────────────────────────────────────
        clusters = api.list_clusters(brain["id"])
        cluster_types = {c["type"] for c in clusters}
        assert "knowledge" in cluster_types
        assert "ai-research" in cluster_types
        assert "todo" in cluster_types
        assert "project" in cluster_types

        # Verify knowledge neurons created
        neurons = api.list_neurons(knowledge["id"])
        assert len(neurons) >= len(knowledge_neurons)

        # Verify todo tasks
        tasks = api.list_neurons(todo_cluster["id"])
        assert len(tasks) == 3

        # Verify thoughts exist
        thoughts = api.list_thoughts()
        thought_names = [t["name"] for t in thoughts]
        assert "Python Learning" in thought_names
        assert "Algorithm Reference" in thought_names
        assert "Infrastructure Notes" in thought_names

        # Verify links
        links = api.list_neuron_links(n_richtext["id"])
        assert len(links) >= 1

        # Verify reminders
        reminders = api.list_all_reminders()
        assert len(reminders) >= 3

        # Verify SR items
        sr_items = api.get_all_sr_items()
        assert len(sr_items) >= 4

        # Verify favorites/pins
        favorites = api.get_favorites()
        fav_ids = {f["id"] for f in favorites}
        assert n_richtext["id"] in fav_ids
        assert n_multi["id"] in fav_ids

        pinned = api.get_pinned()
        pin_ids = {p["id"] for p in pinned}
        assert n_code["id"] in pin_ids
        assert n_table["id"] in pin_ids
