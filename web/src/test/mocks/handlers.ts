import { http, HttpResponse } from 'msw';

const API_BASE = 'http://localhost:8080';

export const handlers = [
  // Brains
  http.get(`${API_BASE}/api/brains`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/brains`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: 'brain-1',
        name: body.name,
        icon: body.icon || null,
        color: body.color || null,
        sortOrder: 0,
        isArchived: false,
        createdAt: '2024-01-01T00:00:00',
        updatedAt: '2024-01-01T00:00:00',
      },
      { status: 201 }
    );
  }),
  http.patch(`${API_BASE}/api/brains/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: params.id,
      name: body.name || 'Updated Brain',
      icon: body.icon || null,
      color: body.color || null,
      sortOrder: 0,
      isArchived: false,
      createdAt: '2024-01-01T00:00:00',
      updatedAt: '2024-01-01T00:00:00',
    });
  }),
  http.delete(`${API_BASE}/api/brains/:id`, () => new HttpResponse(null, { status: 204 })),

  // Clusters
  http.get(`${API_BASE}/api/clusters/brain/:brainId`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/clusters`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: 'cluster-1',
        brainId: body.brainId,
        name: body.name,
        sortOrder: 0,
        isArchived: false,
        createdAt: '2024-01-01T00:00:00',
        updatedAt: '2024-01-01T00:00:00',
      },
      { status: 201 }
    );
  }),
  http.patch(`${API_BASE}/api/clusters/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: params.id,
      brainId: 'brain-1',
      name: body.name || 'Updated Cluster',
      sortOrder: 0,
      isArchived: false,
      createdAt: '2024-01-01T00:00:00',
      updatedAt: '2024-01-01T00:00:00',
    });
  }),
  http.delete(`${API_BASE}/api/clusters/:id`, () => new HttpResponse(null, { status: 204 })),

  // Neurons
  http.get(`${API_BASE}/api/neurons/cluster/:clusterId`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/neurons`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: 'neuron-1',
        brainId: body.brainId,
        clusterId: body.clusterId,
        title: body.title,
        contentJson: null,
        contentText: null,
        templateId: null,
        isArchived: false,
        isDeleted: false,
        isFavorite: false,
        isPinned: false,
        version: 1,
        createdAt: '2024-01-01T00:00:00',
        updatedAt: '2024-01-01T00:00:00',
        lastEditedAt: '2024-01-01T00:00:00',
      },
      { status: 201 }
    );
  }),
  http.delete(`${API_BASE}/api/neurons/:id`, () => new HttpResponse(null, { status: 204 })),

  // Dashboard endpoints
  http.get(`${API_BASE}/api/neurons/recent`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/api/neurons/favorites`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/api/neurons/pinned`, () => HttpResponse.json([])),

  // Revisions
  http.get(`${API_BASE}/api/neurons/:neuronId/revisions`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/neurons/:neuronId/revisions`, ({ params }) =>
    HttpResponse.json({
      id: 'revision-1',
      neuronId: params.neuronId,
      revisionNumber: 1,
      title: 'Snapshot',
      contentJson: null,
      contentText: null,
      createdAt: '2024-01-01T00:00:00',
    })
  ),
  http.delete(`${API_BASE}/api/revisions/:revisionId`, () => new HttpResponse(null, { status: 204 })),

  // Thoughts
  http.get(`${API_BASE}/api/thoughts`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/thoughts`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: 'thought-1',
        name: body.name,
        description: body.description || null,
        neuronTagMode: body.neuronTagMode || 'any',
        brainTagMode: body.brainTagMode || 'any',
        sortOrder: 0,
        createdAt: '2024-01-01T00:00:00',
        updatedAt: '2024-01-01T00:00:00',
        neuronTags: [],
        brainTags: [],
      },
      { status: 201 }
    );
  }),
  http.patch(`${API_BASE}/api/thoughts/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: params.id,
      name: body.name || 'Updated Thought',
      description: body.description || null,
      neuronTagMode: body.neuronTagMode || 'any',
      brainTagMode: body.brainTagMode || 'any',
      sortOrder: 0,
      createdAt: '2024-01-01T00:00:00',
      updatedAt: '2024-01-01T00:00:00',
      neuronTags: [],
      brainTags: [],
    });
  }),
  http.delete(`${API_BASE}/api/thoughts/:id`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API_BASE}/api/thoughts/:id/neurons`, () => HttpResponse.json([])),

  // Trash & Search
  http.get(`${API_BASE}/api/neurons/trash`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/api/search`, () =>
    HttpResponse.json({ results: [], totalCount: 0 })
  ),

  // Spaced Repetition
  http.get(`${API_BASE}/api/spaced-repetition/items/:neuronId`, () =>
    new HttpResponse(null, { status: 404 })
  ),
  http.get(`${API_BASE}/api/spaced-repetition/items`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/api/spaced-repetition/queue`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/spaced-repetition/items/:neuronId`, ({ params }) =>
    HttpResponse.json(
      {
        id: 'sr-1',
        neuronId: params.neuronId,
        neuronTitle: 'Test Neuron',
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        nextReviewAt: new Date().toISOString(),
        lastReviewedAt: null,
        createdAt: '2024-01-01T00:00:00',
      },
      { status: 201 }
    )
  ),
  http.delete(`${API_BASE}/api/spaced-repetition/items/:neuronId`, () =>
    new HttpResponse(null, { status: 204 })
  ),
];
