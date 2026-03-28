"""HTTP client for BrainBook backend API. Used for test data setup and assertions."""

import httpx


class BrainBookAPI:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(base_url=self.base_url, timeout=30)

    def close(self):
        self.client.close()

    # ── Brains ──

    def create_brain(self, name: str, icon: str | None = None, color: str | None = None) -> dict:
        body = {"name": name}
        if icon:
            body["icon"] = icon
        if color:
            body["color"] = color
        r = self.client.post("/api/brains", json=body)
        r.raise_for_status()
        return r.json()

    def list_brains(self) -> list[dict]:
        r = self.client.get("/api/brains")
        r.raise_for_status()
        return r.json()

    def get_brain(self, brain_id: str) -> dict:
        r = self.client.get(f"/api/brains/{brain_id}")
        r.raise_for_status()
        return r.json()

    def update_brain(self, brain_id: str, **kwargs) -> dict:
        r = self.client.patch(f"/api/brains/{brain_id}", json=kwargs)
        r.raise_for_status()
        return r.json()

    def delete_brain(self, brain_id: str):
        r = self.client.delete(f"/api/brains/{brain_id}")
        assert r.status_code == 204

    def archive_brain(self, brain_id: str) -> dict:
        r = self.client.post(f"/api/brains/{brain_id}/archive")
        r.raise_for_status()
        return r.json()

    def restore_brain(self, brain_id: str) -> dict:
        r = self.client.post(f"/api/brains/{brain_id}/restore")
        r.raise_for_status()
        return r.json()

    def reorder_brains(self, ordered_ids: list[str]):
        r = self.client.post("/api/brains/reorder", json={"orderedIds": ordered_ids})
        r.raise_for_status()

    # ── Clusters ──

    def create_cluster(self, name: str, brain_id: str, parent_cluster_id: str | None = None) -> dict:
        body = {"name": name, "brainId": brain_id}
        if parent_cluster_id:
            body["parentClusterId"] = parent_cluster_id
        r = self.client.post("/api/clusters", json=body)
        r.raise_for_status()
        return r.json()

    def list_clusters(self, brain_id: str) -> list[dict]:
        r = self.client.get(f"/api/clusters/brain/{brain_id}")
        r.raise_for_status()
        return r.json()

    def get_cluster(self, cluster_id: str) -> dict:
        r = self.client.get(f"/api/clusters/{cluster_id}")
        r.raise_for_status()
        return r.json()

    def update_cluster(self, cluster_id: str, **kwargs) -> dict:
        r = self.client.patch(f"/api/clusters/{cluster_id}", json=kwargs)
        r.raise_for_status()
        return r.json()

    def delete_cluster(self, cluster_id: str):
        r = self.client.delete(f"/api/clusters/{cluster_id}")
        assert r.status_code == 204

    def archive_cluster(self, cluster_id: str) -> dict:
        r = self.client.post(f"/api/clusters/{cluster_id}/archive")
        r.raise_for_status()
        return r.json()

    def move_cluster(self, cluster_id: str, brain_id: str) -> dict:
        r = self.client.post(f"/api/clusters/{cluster_id}/move", json={"brainId": brain_id})
        r.raise_for_status()
        return r.json()

    # ── Neurons ──

    def create_neuron(self, title: str, brain_id: str, cluster_id: str, **kwargs) -> dict:
        body = {"title": title, "brainId": brain_id, "clusterId": cluster_id, **kwargs}
        r = self.client.post("/api/neurons", json=body)
        r.raise_for_status()
        return r.json()

    def list_neurons(self, cluster_id: str) -> list[dict]:
        r = self.client.get(f"/api/neurons/cluster/{cluster_id}")
        r.raise_for_status()
        return r.json()

    def get_neuron(self, neuron_id: str) -> dict:
        r = self.client.get(f"/api/neurons/{neuron_id}")
        r.raise_for_status()
        return r.json()

    def update_neuron(self, neuron_id: str, **kwargs) -> dict:
        r = self.client.patch(f"/api/neurons/{neuron_id}", json=kwargs)
        r.raise_for_status()
        return r.json()

    def update_neuron_content(self, neuron_id: str, content_json: str, content_text: str, client_version: int) -> httpx.Response:
        body = {"contentJson": content_json, "contentText": content_text, "clientVersion": client_version}
        return self.client.put(f"/api/neurons/{neuron_id}/content", json=body)

    def delete_neuron(self, neuron_id: str):
        r = self.client.delete(f"/api/neurons/{neuron_id}")
        assert r.status_code == 204

    def permanent_delete_neuron(self, neuron_id: str):
        r = self.client.delete(f"/api/neurons/{neuron_id}/permanent")
        assert r.status_code == 204

    def toggle_favorite(self, neuron_id: str) -> dict:
        r = self.client.post(f"/api/neurons/{neuron_id}/favorite")
        r.raise_for_status()
        return r.json()

    def toggle_pin(self, neuron_id: str) -> dict:
        r = self.client.post(f"/api/neurons/{neuron_id}/pin")
        r.raise_for_status()
        return r.json()

    def duplicate_neuron(self, neuron_id: str) -> dict:
        r = self.client.post(f"/api/neurons/{neuron_id}/duplicate")
        r.raise_for_status()
        return r.json()

    def move_neuron(self, neuron_id: str, target_brain_id: str, target_cluster_id: str) -> dict:
        r = self.client.post(f"/api/neurons/{neuron_id}/move", json={"targetBrainId": target_brain_id, "targetClusterId": target_cluster_id})
        r.raise_for_status()
        return r.json()

    def archive_neuron(self, neuron_id: str) -> dict:
        r = self.client.post(f"/api/neurons/{neuron_id}/archive")
        r.raise_for_status()
        return r.json()

    def restore_neuron(self, neuron_id: str) -> dict:
        r = self.client.post(f"/api/neurons/{neuron_id}/restore")
        r.raise_for_status()
        return r.json()

    def restore_from_trash(self, neuron_id: str) -> dict:
        r = self.client.post(f"/api/neurons/{neuron_id}/restore-from-trash")
        r.raise_for_status()
        return r.json()

    def get_recent_neurons(self, limit: int = 20) -> list[dict]:
        r = self.client.get(f"/api/neurons/recent?limit={limit}")
        r.raise_for_status()
        return r.json()

    def get_favorites(self) -> list[dict]:
        r = self.client.get("/api/neurons/favorites")
        r.raise_for_status()
        return r.json()

    def get_pinned(self) -> list[dict]:
        r = self.client.get("/api/neurons/pinned")
        r.raise_for_status()
        return r.json()

    def get_trash(self) -> list[dict]:
        r = self.client.get("/api/neurons/trash")
        r.raise_for_status()
        return r.json()

    def reorder_neurons(self, ordered_ids: list[str]):
        r = self.client.post("/api/neurons/reorder", json={"orderedIds": ordered_ids})
        r.raise_for_status()

    # ── Tags ──

    def create_tag(self, name: str, color: str | None = None) -> dict:
        body = {"name": name}
        if color:
            body["color"] = color
        r = self.client.post("/api/tags", json=body)
        r.raise_for_status()
        return r.json()

    def list_tags(self) -> list[dict]:
        r = self.client.get("/api/tags")
        r.raise_for_status()
        return r.json()

    def search_tags(self, query: str) -> list[dict]:
        r = self.client.get(f"/api/tags/search?q={query}")
        r.raise_for_status()
        return r.json()

    def delete_tag(self, tag_id: str):
        r = self.client.delete(f"/api/tags/{tag_id}")
        assert r.status_code == 204

    def add_tag_to_neuron(self, neuron_id: str, tag_id: str):
        r = self.client.post(f"/api/tags/neurons/{neuron_id}/tags/{tag_id}")
        r.raise_for_status()

    def remove_tag_from_neuron(self, neuron_id: str, tag_id: str):
        r = self.client.delete(f"/api/tags/neurons/{neuron_id}/tags/{tag_id}")
        assert r.status_code == 204

    def get_neuron_tags(self, neuron_id: str) -> list[dict]:
        r = self.client.get(f"/api/tags/neurons/{neuron_id}/tags")
        r.raise_for_status()
        return r.json()

    # ── Revisions ──

    def list_revisions(self, neuron_id: str) -> list[dict]:
        r = self.client.get(f"/api/neurons/{neuron_id}/revisions")
        r.raise_for_status()
        return r.json()

    def get_revision(self, revision_id: str) -> dict:
        r = self.client.get(f"/api/revisions/{revision_id}")
        r.raise_for_status()
        return r.json()

    def restore_revision(self, revision_id: str) -> dict:
        r = self.client.post(f"/api/revisions/{revision_id}/restore")
        r.raise_for_status()
        return r.json()

    # ── Attachments ──

    def upload_attachment(self, neuron_id: str, filename: str, content: bytes, content_type: str = "text/plain") -> dict:
        r = self.client.post(
            f"/api/attachments/neuron/{neuron_id}",
            files={"file": (filename, content, content_type)},
        )
        r.raise_for_status()
        return r.json()

    def list_attachments(self, neuron_id: str) -> list[dict]:
        r = self.client.get(f"/api/attachments/neuron/{neuron_id}")
        r.raise_for_status()
        return r.json()

    def download_attachment(self, attachment_id: str) -> bytes:
        r = self.client.get(f"/api/attachments/{attachment_id}/download")
        r.raise_for_status()
        return r.content

    def delete_attachment(self, attachment_id: str):
        r = self.client.delete(f"/api/attachments/{attachment_id}")
        assert r.status_code == 204

    # ── Templates ──

    def create_template(self, name: str, content_json: str, description: str | None = None) -> dict:
        body = {"name": name, "contentJson": content_json}
        if description:
            body["description"] = description
        r = self.client.post("/api/templates", json=body)
        r.raise_for_status()
        return r.json()

    def list_templates(self) -> list[dict]:
        r = self.client.get("/api/templates")
        r.raise_for_status()
        return r.json()

    def get_template(self, template_id: str) -> dict:
        r = self.client.get(f"/api/templates/{template_id}")
        r.raise_for_status()
        return r.json()

    def update_template(self, template_id: str, **kwargs) -> dict:
        r = self.client.patch(f"/api/templates/{template_id}", json=kwargs)
        r.raise_for_status()
        return r.json()

    def delete_template(self, template_id: str):
        r = self.client.delete(f"/api/templates/{template_id}")
        assert r.status_code == 204

    # ── Search ──

    def search(self, query: str, brain_id: str | None = None, cluster_id: str | None = None, page: int = 0, size: int = 20) -> dict:
        params = {"q": query, "page": page, "size": size}
        if brain_id:
            params["brainId"] = brain_id
        if cluster_id:
            params["clusterId"] = cluster_id
        r = self.client.get("/api/search", params=params)
        r.raise_for_status()
        return r.json()
