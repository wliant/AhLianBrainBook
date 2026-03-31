"""Shared fixtures for BrainBook E2E tests."""

import os
import warnings

import pytest
from dotenv import load_dotenv
from playwright.sync_api import Page

from helpers.api_client import BrainBookAPI
from helpers.minio_client import MinIOHelper
from helpers.page_helpers import navigate_to_neuron, unique_name

load_dotenv()

BASE_URL = os.environ["BASE_URL"]
API_URL = os.environ["API_URL"]
MINIO_ENDPOINT = os.environ["MINIO_ENDPOINT"]
MINIO_ACCESS_KEY = os.environ["MINIO_ACCESS_KEY"]
MINIO_SECRET_KEY = os.environ["MINIO_SECRET_KEY"]
MINIO_BUCKET = os.environ["MINIO_BUCKET"]
MINIO_SECURE = os.environ.get("MINIO_SECURE", "false").lower() == "true"


@pytest.fixture(scope="session")
def api() -> BrainBookAPI:
    client = BrainBookAPI(API_URL)
    yield client
    client.close()


@pytest.fixture(scope="session")
def minio() -> MinIOHelper:
    return MinIOHelper(
        endpoint=MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        bucket=MINIO_BUCKET,
        secure=MINIO_SECURE,
    )


@pytest.fixture
def home(page: Page) -> Page:
    """Navigate to the dashboard and return the page."""
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    return page


@pytest.fixture
def brain_with_cluster(api: BrainBookAPI):
    """Create a brain and cluster for testing, clean up after."""
    brain = api.create_brain(unique_name("E2E Brain"))
    cluster = api.create_cluster(unique_name("E2E Cluster"), brain["id"])
    yield brain, cluster
    # Cleanup: delete all neurons in cluster, then cluster, then brain
    try:
        neurons = api.list_neurons(cluster["id"])
        for n in neurons:
            api.permanent_delete_neuron(n["id"])
        # Also clean trash
        trash = api.get_trash()
        for n in trash:
            if n["brainId"] == brain["id"]:
                api.permanent_delete_neuron(n["id"])
        api.delete_cluster(cluster["id"])
        api.delete_brain(brain["id"])
    except Exception as e:
        warnings.warn(f"Cleanup failed for brain {brain['id']}: {e}")


@pytest.fixture
def neuron_in_cluster(api: BrainBookAPI, brain_with_cluster):
    """Create a neuron inside the test brain/cluster."""
    brain, cluster = brain_with_cluster
    neuron = api.create_neuron(unique_name("E2E Neuron"), brain["id"], cluster["id"])
    return brain, cluster, neuron


@pytest.fixture
def two_neurons_in_cluster(api: BrainBookAPI, brain_with_cluster):
    """Create two neurons for link testing."""
    brain, cluster = brain_with_cluster
    neuron_a = api.create_neuron(unique_name("E2E Neuron A"), brain["id"], cluster["id"])
    neuron_b = api.create_neuron(unique_name("E2E Neuron B"), brain["id"], cluster["id"])
    return brain, cluster, neuron_a, neuron_b


@pytest.fixture
def neuron_with_content(api: BrainBookAPI, brain_with_cluster):
    """Create a neuron with actual content for revision/history testing."""
    brain, cluster = brain_with_cluster
    neuron = api.create_neuron(unique_name("E2E Content Neuron"), brain["id"], cluster["id"])
    content = '{"version":2,"sections":[{"id":"s1","type":"rich-text","content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test content for revision"}]}]}}]}'
    api.update_neuron_content(neuron["id"], content, "Test content for revision", neuron["version"])
    updated = api.get_neuron(neuron["id"])
    return brain, cluster, updated


@pytest.fixture
def nested_clusters(api: BrainBookAPI):
    """Create brain > cluster > child_cluster hierarchy."""
    brain = api.create_brain(unique_name("E2E Nested Brain"))
    parent = api.create_cluster(unique_name("E2E Parent Cluster"), brain["id"])
    child = api.create_cluster(unique_name("E2E Child Cluster"), brain["id"], parent_cluster_id=parent["id"])
    yield brain, parent, child
    try:
        api.delete_cluster(child["id"])
        api.delete_cluster(parent["id"])
        api.delete_brain(brain["id"])
    except Exception as e:
        warnings.warn(f"Cleanup failed for nested clusters brain {brain['id']}: {e}")


@pytest.fixture
def neuron_with_tags(api: BrainBookAPI, brain_with_cluster):
    """Create a neuron with 2 tags attached."""
    brain, cluster = brain_with_cluster
    neuron = api.create_neuron(unique_name("E2E Tagged Neuron"), brain["id"], cluster["id"])
    tag_a = api.create_tag(unique_name("E2E Tag A"))
    tag_b = api.create_tag(unique_name("E2E Tag B"))
    api.add_tag_to_neuron(neuron["id"], tag_a["id"])
    api.add_tag_to_neuron(neuron["id"], tag_b["id"])
    yield brain, cluster, neuron, [tag_a, tag_b]
    try:
        api.delete_tag(tag_a["id"])
        api.delete_tag(tag_b["id"])
    except Exception as e:
        warnings.warn(f"Cleanup failed for tags: {e}")


@pytest.fixture
def neuron_with_attachment(api: BrainBookAPI, brain_with_cluster):
    """Create a neuron with a text file attachment."""
    brain, cluster = brain_with_cluster
    neuron = api.create_neuron(unique_name("E2E Attachment Neuron"), brain["id"], cluster["id"])
    attachment = api.upload_attachment(neuron["id"], "test.txt", b"Hello E2E", "text/plain")
    yield brain, cluster, neuron, attachment
    try:
        api.delete_attachment(attachment["id"])
    except Exception as e:
        warnings.warn(f"Cleanup failed for attachment {attachment['id']}: {e}")


@pytest.fixture
def neuron_on_page(page: Page, api: BrainBookAPI, neuron_in_cluster):
    """Navigate to a neuron editor page and return (page, brain, cluster, neuron)."""
    brain, cluster, neuron = neuron_in_cluster
    navigate_to_neuron(page, brain["id"], cluster["id"], neuron["id"])
    return page, brain, cluster, neuron
