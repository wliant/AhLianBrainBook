# REST API Specification

Base URL: `http://localhost:8080`

All responses use JSON. Successful mutations return the updated resource unless otherwise noted. Deletes return `204 No Content`. Error responses include a message field.

---

## Brains

### `GET /api/brains`
List all non-archived brains, ordered by `sortOrder`.

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "string",
    "description": "string | null",
    "icon": "string | null",
    "color": "string | null",
    "sortOrder": 0,
    "isArchived": false,
    "createdBy": "string",
    "lastUpdatedBy": "string",
    "createdAt": "2024-01-01T00:00:00",
    "updatedAt": "2024-01-01T00:00:00"
  }
]
```

### `POST /api/brains`
Create a new brain.

**Request:**
```json
{ "name": "string", "description": "string?", "icon": "string?", "color": "string?" }
```
**Response:** `200 OK` — BrainResponse

### `GET /api/brains/{id}`
Get brain by ID.

**Response:** `200 OK` — BrainResponse
**Error:** `404` if not found

### `PATCH /api/brains/{id}`
Update brain fields (name, description, icon, color).

**Request:**
```json
{ "name": "string", "description": "string?", "icon": "string?", "color": "string?" }
```
**Response:** `200 OK` — BrainResponse

### `DELETE /api/brains/{id}`
Delete brain permanently (cascades to clusters, neurons, and related data).

**Response:** `204 No Content`

### `POST /api/brains/{id}/archive`
Archive a brain (sets `isArchived = true`).

**Response:** `200 OK` — BrainResponse

### `POST /api/brains/{id}/restore`
Restore an archived brain (sets `isArchived = false`).

**Response:** `200 OK` — BrainResponse

### `POST /api/brains/reorder`
Reorder brains by providing an ordered list of IDs.

**Request:**
```json
{ "orderedIds": ["uuid1", "uuid2", "uuid3"] }
```
**Response:** `200 OK`

---

## Brain Stats

### `GET /api/brains/{id}/stats`
Get aggregated statistics for a brain.

**Response:** `200 OK`
```json
{
  "clusterCount": 5,
  "neuronCount": 42,
  "tagCount": 10,
  "linkCount": 15,
  "simpleCount": 20,
  "moderateCount": 15,
  "complexCount": 7,
  "mostConnected": [
    { "id": "uuid", "title": "string", "clusterId": "uuid", "linkCount": 8 }
  ],
  "recentlyEdited": [
    { "id": "uuid", "title": "string", "clusterId": "uuid", "lastEditedAt": "2024-01-01T00:00:00" }
  ]
}
```

---

## Import / Export

### `GET /api/brains/{id}/export`
Export a complete brain as JSON, including all clusters, neurons (with content), tags, and links.

**Response:** `200 OK`
```json
{
  "version": "1.0",
  "brain": {
    "id": "uuid", "name": "string", "icon": "string?", "color": "string?",
    "description": "string?", "createdAt": "2024-01-01T00:00:00"
  },
  "clusters": [
    { "id": "uuid", "name": "string", "parentClusterId": "uuid?", "sortOrder": 0, "tagNames": ["string"] }
  ],
  "neurons": [
    {
      "id": "uuid", "clusterId": "uuid", "title": "string",
      "contentJson": "string?", "contentText": "string?",
      "sortOrder": 0, "isFavorite": false, "isPinned": false,
      "tagNames": ["string"], "createdAt": "2024-01-01T00:00:00"
    }
  ],
  "tags": [
    { "name": "string", "color": "string?" }
  ],
  "links": [
    { "sourceNeuronId": "uuid", "targetNeuronId": "uuid", "label": "string?", "linkType": "string?", "weight": 1.0 }
  ]
}
```

### `POST /api/brains/import`
Import a brain from JSON. Creates brain, clusters, neurons, tags, and links in a single transaction.

**Request:** Same structure as export response body.
**Response:** `201 Created` — BrainResponse (the newly created brain)

---

## Clusters

### `GET /api/clusters/brain/{brainId}`
List non-archived clusters for a brain, ordered by `sortOrder`.

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "brainId": "uuid",
    "name": "string",
    "parentClusterId": "uuid | null",
    "sortOrder": 0,
    "isArchived": false,
    "createdBy": "string",
    "lastUpdatedBy": "string",
    "createdAt": "2024-01-01T00:00:00",
    "updatedAt": "2024-01-01T00:00:00"
  }
]
```

### `POST /api/clusters`
Create a new cluster.

**Request:**
```json
{ "name": "string", "brainId": "uuid", "parentClusterId": "uuid?" }
```
**Response:** `200 OK` — ClusterResponse

### `GET /api/clusters/{id}`
Get cluster by ID.

**Response:** `200 OK` — ClusterResponse

### `PATCH /api/clusters/{id}`
Update cluster name or parent.

**Request:**
```json
{ "name": "string", "brainId": "uuid", "parentClusterId": "uuid?" }
```
**Response:** `200 OK` — ClusterResponse

### `DELETE /api/clusters/{id}`
Delete cluster permanently.

**Response:** `204 No Content`

### `POST /api/clusters/{id}/archive`
Archive a cluster.

**Response:** `200 OK` — ClusterResponse

### `POST /api/clusters/{id}/restore`
Restore an archived cluster.

**Response:** `200 OK` — ClusterResponse

### `POST /api/clusters/reorder`
Reorder clusters.

**Request:**
```json
{ "orderedIds": ["uuid1", "uuid2"] }
```
**Response:** `200 OK`

### `POST /api/clusters/{id}/move`
Move cluster to a different brain.

**Request:**
```json
{ "brainId": "uuid" }
```
**Response:** `200 OK` — ClusterResponse

---

## Neurons

### `GET /api/neurons/cluster/{clusterId}`
List non-deleted, non-archived neurons in a cluster, ordered by `sortOrder`.

**Response:** `200 OK` — `NeuronResponse[]`

### `GET /api/neurons/recent?limit=20`
Get recently edited neurons, ordered by `lastEditedAt` descending.

**Response:** `200 OK` — `NeuronResponse[]`

### `GET /api/neurons/favorites`
Get favorite neurons, ordered by `updatedAt` descending.

**Response:** `200 OK` — `NeuronResponse[]`

### `GET /api/neurons/pinned`
Get pinned neurons, ordered by `updatedAt` descending.

**Response:** `200 OK` — `NeuronResponse[]`

### `GET /api/neurons/trash`
Get soft-deleted neurons, ordered by `updatedAt` descending.

**Response:** `200 OK` — `NeuronResponse[]`

### `POST /api/neurons`
Create a new neuron.

**Request:**
```json
{
  "title": "string",
  "brainId": "uuid",
  "clusterId": "uuid",
  "contentJson": "string?",
  "contentText": "string?",
  "templateId": "uuid?"
}
```
**Response:** `200 OK` — NeuronResponse (version=1, all flags false)

### `GET /api/neurons/{id}`
Get neuron by ID with tags populated.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "brainId": "uuid",
  "clusterId": "uuid",
  "title": "string",
  "contentJson": "string | null",
  "contentText": "string | null",
  "templateId": "uuid | null",
  "sortOrder": 0,
  "isFavorite": false,
  "isPinned": false,
  "isArchived": false,
  "isDeleted": false,
  "version": 1,
  "complexity": "simple | moderate | complex | null",
  "createdBy": "string",
  "lastUpdatedBy": "string",
  "lastEditedAt": "2024-01-01T00:00:00",
  "createdAt": "2024-01-01T00:00:00",
  "updatedAt": "2024-01-01T00:00:00",
  "tags": [{ "id": "uuid", "name": "string", "color": "string | null", "createdAt": "...", "updatedAt": "..." }]
}
```

### `PATCH /api/neurons/{id}`
Update neuron metadata (title, templateId, complexity, etc.).

**Request:**
```json
{
  "title": "string",
  "brainId": "uuid",
  "clusterId": "uuid",
  "contentJson": "string?",
  "contentText": "string?",
  "templateId": "uuid?"
}
```
**Response:** `200 OK` — NeuronResponse

### `PUT /api/neurons/{id}/content`
Update neuron content with optimistic locking.

**Request:**
```json
{
  "contentJson": "string",
  "contentText": "string",
  "clientVersion": 1
}
```
**Response:** `200 OK` — NeuronResponse (version incremented)
**Error:** `409 Conflict` if `clientVersion` does not match server version

### `DELETE /api/neurons/{id}`
Soft delete — moves neuron to trash (`isDeleted = true`).

**Response:** `204 No Content`

### `POST /api/neurons/{id}/archive`
Archive neuron.

**Response:** `200 OK` — NeuronResponse

### `POST /api/neurons/{id}/restore`
Restore from archive.

**Response:** `200 OK` — NeuronResponse

### `POST /api/neurons/{id}/move`
Move neuron to a different brain/cluster.

**Request:**
```json
{ "targetClusterId": "uuid", "targetBrainId": "uuid" }
```
**Response:** `200 OK` — NeuronResponse

### `POST /api/neurons/{id}/duplicate`
Create a copy of the neuron with title suffixed " (copy)", version reset to 1, sortOrder+1.

**Response:** `200 OK` — NeuronResponse (the new copy)

### `POST /api/neurons/{id}/favorite`
Toggle favorite flag.

**Response:** `200 OK` — NeuronResponse

### `POST /api/neurons/{id}/pin`
Toggle pin flag.

**Response:** `200 OK` — NeuronResponse

### `POST /api/neurons/reorder`
Reorder neurons.

**Request:**
```json
{ "orderedIds": ["uuid1", "uuid2"] }
```
**Response:** `200 OK`

### `POST /api/neurons/{id}/restore-from-trash`
Restore a soft-deleted neuron (`isDeleted = false`).

**Response:** `200 OK` — NeuronResponse

### `DELETE /api/neurons/{id}/permanent`
Permanently delete neuron from database.

**Response:** `204 No Content`

---

## Reminders

Reminders are managed as a sub-resource of neurons. Each neuron may have at most one active reminder.

### `POST /api/neurons/{id}/reminder`
Create a reminder for a neuron.

**Request:**
```json
{
  "reminderType": "ONCE | RECURRING",
  "triggerAt": "2024-06-01T09:00:00",
  "recurrencePattern": "DAILY | WEEKLY | MONTHLY | null",
  "recurrenceInterval": 1
}
```
**Response:** `200 OK` — ReminderResponse
**Error:** `409 Conflict` if a reminder already exists for this neuron

### `GET /api/neurons/{id}/reminder`
Get the reminder for a neuron.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "neuronId": "uuid",
  "reminderType": "ONCE | RECURRING",
  "triggerAt": "2024-06-01T09:00:00",
  "recurrencePattern": "DAILY | WEEKLY | MONTHLY | null",
  "recurrenceInterval": 1,
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00",
  "updatedAt": "2024-01-01T00:00:00"
}
```
**Error:** `404` if no reminder exists

### `PUT /api/neurons/{id}/reminder`
Update the reminder for a neuron.

**Request:** Same as POST.
**Response:** `200 OK` — ReminderResponse

### `DELETE /api/neurons/{id}/reminder`
Delete the reminder for a neuron.

**Response:** `204 No Content`

---

## Neuron Links

### `GET /api/neuron-links/neuron/{neuronId}`
List all links for a neuron (both incoming and outgoing).

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "sourceNeuronId": "uuid",
    "sourceNeuronTitle": "string",
    "targetNeuronId": "uuid",
    "targetNeuronTitle": "string",
    "label": "string | null",
    "linkType": "string | null",
    "weight": 1.0,
    "source": "manual | editor",
    "createdAt": "2024-01-01T00:00:00"
  }
]
```

### `GET /api/neuron-links/brain/{brainId}`
List all links within a brain (for knowledge graph visualization).

**Response:** `200 OK` — `NeuronLinkResponse[]`

### `POST /api/neuron-links`
Create a link between two neurons.

**Request:**
```json
{
  "sourceNeuronId": "uuid",
  "targetNeuronId": "uuid",
  "label": "string?",
  "linkType": "string?",
  "weight": 1.0,
  "source": "string?"
}
```
**Response:** `201 Created` — NeuronLinkResponse

### `DELETE /api/neuron-links/{id}`
Delete a link.

**Response:** `204 No Content`

---

## Tags

### `GET /api/tags`
List all tags.

**Response:** `200 OK` — `TagResponse[]`

### `GET /api/tags/search?q=query`
Search tags by name (case-insensitive contains).

**Response:** `200 OK` — `TagResponse[]`

### `POST /api/tags`
Create a new tag.

**Request:**
```json
{ "name": "string", "color": "string?" }
```
**Response:** `200 OK` — TagResponse

### `DELETE /api/tags/{id}`
Delete a tag (cascades to neuron_tags and brain_tags).

**Response:** `204 No Content`

### `POST /api/tags/neurons/{neuronId}/tags/{tagId}`
Add a tag to a neuron. Idempotent (ON CONFLICT DO NOTHING).

**Response:** `200 OK`

### `DELETE /api/tags/neurons/{neuronId}/tags/{tagId}`
Remove a tag from a neuron.

**Response:** `204 No Content`

### `GET /api/tags/neurons/{neuronId}/tags`
Get all tags for a neuron.

**Response:** `200 OK` — `TagResponse[]`

### `POST /api/tags/brains/{brainId}/tags/{tagId}`
Add a tag to a brain. Idempotent.

**Response:** `200 OK`

### `DELETE /api/tags/brains/{brainId}/tags/{tagId}`
Remove a tag from a brain.

**Response:** `204 No Content`

### `GET /api/tags/brains/{brainId}/tags`
Get all tags for a brain.

**Response:** `200 OK` — `TagResponse[]`

---

## Revisions

### `GET /api/neurons/{neuronId}/revisions`
List revisions for a neuron, ordered by `revisionNumber` descending.

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "neuronId": "uuid",
    "revisionNumber": 1,
    "title": "string | null",
    "contentJson": "string | null",
    "contentText": "string | null",
    "createdAt": "2024-01-01T00:00:00"
  }
]
```

### `GET /api/revisions/{revisionId}`
Get a specific revision.

**Response:** `200 OK` — RevisionResponse

### `POST /api/neurons/{neuronId}/revisions`
Create a manual revision snapshot of the neuron's current content.

**Response:** `200 OK` — RevisionResponse

### `POST /api/revisions/{revisionId}/restore`
Restore a neuron to this revision's content. Increments neuron version, updates `lastEditedAt`.

**Response:** `200 OK` — NeuronResponse

### `DELETE /api/revisions/{revisionId}`
Delete a specific revision.

**Response:** `204 No Content`

---

## Attachments

### `GET /api/attachments/neuron/{neuronId}`
List attachments for a neuron.

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "neuronId": "uuid",
    "fileName": "string",
    "filePath": "string",
    "fileSize": 12345,
    "contentType": "image/png",
    "createdAt": "2024-01-01T00:00:00"
  }
]
```

### `POST /api/attachments/neuron/{neuronId}`
Upload a file attachment. Multipart form data with field name `file`.

**Response:** `200 OK` — AttachmentResponse

### `GET /api/attachments/{id}/download`
Download attachment binary. Returns file as `Resource` with appropriate content type.

**Response:** `200 OK` — binary file

### `DELETE /api/attachments/{id}`
Delete attachment from MinIO and database.

**Response:** `204 No Content`

---

## Templates

### `GET /api/templates`
List all templates, ordered by name.

**Response:** `200 OK` — `TemplateResponse[]`

### `POST /api/templates`
Create a template.

**Request:**
```json
{ "name": "string", "description": "string?", "contentJson": "string" }
```
**Response:** `200 OK` — TemplateResponse

### `GET /api/templates/{id}`
Get template by ID.

**Response:** `200 OK` — TemplateResponse

### `PATCH /api/templates/{id}`
Update template.

**Request:**
```json
{ "name": "string", "description": "string?", "contentJson": "string" }
```
**Response:** `200 OK` — TemplateResponse

### `DELETE /api/templates/{id}`
Delete template.

**Response:** `204 No Content`

---

## Thoughts

Thoughts are tag-based filtered views. They define criteria (neuron tags and/or brain tags with AND/OR matching modes) and dynamically resolve the matching neurons.

### `GET /api/thoughts`
List all thoughts.

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "string",
    "description": "string | null",
    "neuronTagMode": "any | all",
    "brainTagMode": "any | all",
    "sortOrder": 0,
    "createdAt": "2024-01-01T00:00:00",
    "updatedAt": "2024-01-01T00:00:00",
    "neuronTags": [{ "id": "uuid", "name": "string", "color": "string | null", "createdAt": "...", "updatedAt": "..." }],
    "brainTags": [{ "id": "uuid", "name": "string", "color": "string | null", "createdAt": "...", "updatedAt": "..." }]
  }
]
```

### `POST /api/thoughts`
Create a thought.

**Request:**
```json
{
  "name": "string",
  "description": "string?",
  "neuronTagMode": "any | all",
  "brainTagMode": "any | all",
  "neuronTagIds": ["uuid"],
  "brainTagIds": ["uuid"]
}
```
**Validation:** `name` required (max 255), `description` max 5000, `neuronTagMode`/`brainTagMode` must be `any` or `all`, at least one neuron tag required.
**Response:** `201 Created` — ThoughtResponse

### `GET /api/thoughts/{id}`
Get thought by ID.

**Response:** `200 OK` — ThoughtResponse

### `PATCH /api/thoughts/{id}`
Update thought.

**Request:** Same as POST.
**Response:** `200 OK` — ThoughtResponse

### `DELETE /api/thoughts/{id}`
Delete thought.

**Response:** `204 No Content`

### `GET /api/thoughts/{id}/neurons`
Resolve and return all neurons matching this thought's tag criteria.

**Response:** `200 OK` — `NeuronResponse[]`

---

## Notifications

### `GET /api/notifications?page=0&size=20`
List notifications, ordered by `createdAt` descending (paginated).

**Query Parameters:**
| Param | Required | Default | Description        |
|-------|----------|---------|--------------------|
| page  | no       | 0       | Page number        |
| size  | no       | 20      | Results per page   |

**Response:** `200 OK` — `NotificationResponse[]`
```json
[
  {
    "id": "uuid",
    "reminderId": "uuid | null",
    "neuronId": "uuid",
    "brainId": "uuid",
    "clusterId": "uuid",
    "neuronTitle": "string",
    "message": "string",
    "isRead": false,
    "createdAt": "2024-01-01T00:00:00"
  }
]
```

### `GET /api/notifications/unread/count`
Get the count of unread notifications.

**Response:** `200 OK`
```json
{ "count": 5 }
```

### `POST /api/notifications/{id}/read`
Mark a single notification as read.

**Response:** `200 OK`

### `POST /api/notifications/read-all`
Mark all notifications as read.

**Response:** `200 OK`

---

## Settings

### `GET /api/settings`
Get application settings.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "displayName": "string",
  "createdAt": "2024-01-01T00:00:00",
  "updatedAt": "2024-01-01T00:00:00"
}
```

### `PATCH /api/settings`
Update application settings.

**Request:**
```json
{ "displayName": "string" }
```
**Response:** `200 OK` — AppSettingsResponse

---

## Search

### `GET /api/search?q=query&brainId=uuid&clusterId=uuid&page=0&size=20`
Full-text search across neuron content using PostgreSQL tsvector.

**Query Parameters:**
| Param     | Required | Default | Description                    |
|-----------|----------|---------|--------------------------------|
| q         | yes      | —       | Search query string            |
| brainId   | no       | —       | Filter to specific brain       |
| clusterId | no       | —       | Filter to specific cluster     |
| page      | no       | 0       | Page number (zero-based)       |
| size      | no       | 20      | Results per page               |

**Response:** `200 OK`
```json
{
  "results": [ /* NeuronResponse[] */ ],
  "totalCount": 42
}
```

---

## Error Responses

| Status | Meaning            | When                                     |
|--------|--------------------|------------------------------------------|
| 400    | Bad Request        | Validation failure                       |
| 404    | Not Found          | Entity does not exist                    |
| 409    | Conflict           | Optimistic locking version mismatch, or duplicate constraint violation |
| 500    | Internal Error     | Unexpected server error                  |
