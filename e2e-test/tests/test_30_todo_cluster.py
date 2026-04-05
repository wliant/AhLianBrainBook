"""E2E tests for todo cluster (GAP-002)."""

import pytest
from helpers.api_client import BrainBookAPI
from helpers.page_helpers import unique_name


class TestTodoClusterAPI:
    """API-level todo cluster tests."""

    def test_create_todo_cluster(self, api: BrainBookAPI):
        brain = api.create_brain(unique_name("Todo Brain"))
        try:
            cluster = api.create_cluster("Tasks", brain["id"], cluster_type="todo")
            assert cluster["type"] == "todo"
            assert cluster["name"] == "Tasks"
        finally:
            api.delete_brain(brain["id"])

    def test_todo_metadata_get_or_create(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        meta = api.get_todo_metadata(neuron["id"])

        assert meta["neuronId"] == neuron["id"]
        assert meta["completed"] is False
        assert meta["priority"] == "normal"

    def test_update_todo_completed(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        api.get_todo_metadata(neuron["id"])  # ensure exists

        meta = api.update_todo_metadata(neuron["id"], completed=True)

        assert meta["completed"] is True
        assert meta["completedAt"] is not None

    def test_update_todo_priority(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        api.get_todo_metadata(neuron["id"])

        meta = api.update_todo_metadata(neuron["id"], priority="critical")
        assert meta["priority"] == "critical"

    def test_set_due_date(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster
        api.get_todo_metadata(neuron["id"])

        meta = api.update_todo_metadata(neuron["id"], dueDate="2026-12-31")
        assert meta["dueDate"] == "2026-12-31"

    def test_create_task_from_neuron(self, api: BrainBookAPI, neuron_in_cluster):
        brain, cluster, neuron = neuron_in_cluster

        result = api.create_task_from_neuron(brain["id"], neuron["id"], "New task item")

        assert result["neuron"]["title"] == "New task item"
        assert result["todoMetadata"]["priority"] == "normal"
        assert result["clusterId"] is not None

    def test_get_cluster_todo_metadata(self, api: BrainBookAPI):
        brain = api.create_brain(unique_name("Todo Batch Brain"))
        try:
            cluster = api.create_cluster("Tasks", brain["id"], cluster_type="todo")
            n1 = api.create_neuron("Task 1", brain["id"], cluster["id"])
            api.get_todo_metadata(n1["id"])

            batch = api.get_cluster_todo_metadata(cluster["id"])
            assert n1["id"] in batch
        finally:
            api.delete_brain(brain["id"])


@pytest.mark.browser
class TestTodoClusterBrowser:
    """Browser-level todo cluster tests."""

    def test_todo_cluster_view_loads(self, page, api):
        brain = api.create_brain(unique_name("Todo View Brain"))
        try:
            cluster = api.create_cluster("Tasks", brain["id"], cluster_type="todo")
            n1 = api.create_neuron("Buy groceries", brain["id"], cluster["id"])
            api.get_todo_metadata(n1["id"])

            page.goto(f"{page.context.browser.contexts[0].pages[0].url.split('/')[0]}//{page.context.browser.contexts[0].pages[0].url.split('/')[2]}/brain/{brain['id']}/cluster/{cluster['id']}")
            page.wait_for_load_state("networkidle")

            # The todo quick-add input should be visible
            assert page.get_by_test_id("todo-quick-add").is_visible() or \
                   page.get_by_placeholder("Add a task").is_visible()
        finally:
            api.delete_brain(brain["id"])
