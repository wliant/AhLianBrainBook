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

  // Project Config
  http.get(`${API_BASE}/api/clusters/:clusterId/project-config`, ({ params }) =>
    HttpResponse.json({
      id: 'config-1',
      clusterId: params.clusterId,
      repoUrl: 'https://github.com/owner/repo',
      defaultBranch: 'main',
      createdAt: '2024-01-01T00:00:00',
      updatedAt: '2024-01-01T00:00:00',
    })
  ),

  http.patch(`${API_BASE}/api/clusters/:clusterId/project-config`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: 'config-1',
      clusterId: params.clusterId,
      repoUrl: 'https://github.com/owner/repo',
      defaultBranch: body.defaultBranch || 'main',
      createdAt: '2024-01-01T00:00:00',
      updatedAt: '2024-01-01T00:00:00',
    });
  }),

  // Browse endpoints
  http.get(`${API_BASE}/api/clusters/:clusterId/browse/tree`, () =>
    HttpResponse.json([
      { name: 'src', path: 'src', type: 'directory', size: null },
      { name: 'Main.java', path: 'src/Main.java', type: 'file', size: 1024 },
      { name: 'README.md', path: 'README.md', type: 'file', size: 256 },
    ])
  ),
  http.get(`${API_BASE}/api/clusters/:clusterId/browse/file`, ({ request }) => {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || 'unknown';
    return HttpResponse.json({
      path,
      content: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}',
      language: 'java',
      size: 100,
    });
  }),
  http.get(`${API_BASE}/api/clusters/:clusterId/browse/branches`, () =>
    HttpResponse.json([{ name: 'main' }, { name: 'develop' }])
  ),

  // Neuron Anchors
  http.get(`${API_BASE}/api/neuron-anchors/cluster/:clusterId`, () =>
    HttpResponse.json({ content: [], totalElements: 0 })
  ),
  http.get(`${API_BASE}/api/neuron-anchors/cluster/:clusterId/file`, () =>
    HttpResponse.json({ content: [], totalElements: 0 })
  ),
  http.get(`${API_BASE}/api/neuron-anchors/cluster/:clusterId/orphaned`, () =>
    HttpResponse.json([])
  ),
  http.post(`${API_BASE}/api/neuron-anchors`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: 'anchor-1',
        neuronId: body.neuronId,
        clusterId: body.clusterId,
        filePath: body.filePath,
        startLine: body.startLine,
        endLine: body.endLine,
        contentHash: 'abc123',
        commitSha: null,
        status: 'active',
        driftedStartLine: null,
        driftedEndLine: null,
        createdAt: '2024-01-01T00:00:00',
        updatedAt: '2024-01-01T00:00:00',
      },
      { status: 201 }
    );
  }),
  http.patch(`${API_BASE}/api/neuron-anchors/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: params.id,
      neuronId: 'neuron-1',
      clusterId: 'cluster-1',
      filePath: body.filePath,
      startLine: body.startLine,
      endLine: body.endLine,
      contentHash: 'updated-hash',
      commitSha: null,
      status: 'active',
      driftedStartLine: null,
      driftedEndLine: null,
      createdAt: '2024-01-01T00:00:00',
      updatedAt: '2024-01-01T00:00:00',
    });
  }),
  http.delete(`${API_BASE}/api/neuron-anchors/:id`, () =>
    new HttpResponse(null, { status: 204 })
  ),
  http.post(`${API_BASE}/api/neuron-anchors/:id/confirm-drift`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      status: 'active',
      createdAt: '2024-01-01T00:00:00',
      updatedAt: '2024-01-01T00:00:00',
    })
  ),

  // Sandbox lifecycle
  http.post(`${API_BASE}/api/clusters/:clusterId/sandbox`, async ({ request, params }) => {
    const body = ((await request.json().catch(() => null)) || {}) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: 'sandbox-1',
        clusterId: params.clusterId,
        brainId: 'brain-1',
        brainName: 'Test Brain',
        clusterName: 'Test Project',
        repoUrl: 'https://github.com/owner/repo',
        currentBranch: body.branch || 'main',
        currentCommit: null,
        isShallow: body.shallow ?? true,
        status: 'cloning',
        diskUsageBytes: null,
        errorMessage: null,
        lastAccessedAt: '2024-01-01T00:00:00',
        createdAt: '2024-01-01T00:00:00',
        updatedAt: '2024-01-01T00:00:00',
      },
      { status: 202 }
    );
  }),
  http.get(`${API_BASE}/api/clusters/:clusterId/sandbox`, ({ params }) =>
    HttpResponse.json({
      id: 'sandbox-1',
      clusterId: params.clusterId,
      brainId: 'brain-1',
      brainName: 'Test Brain',
      clusterName: 'Test Project',
      repoUrl: 'https://github.com/owner/repo',
      currentBranch: 'main',
      currentCommit: 'abc123def456',
      isShallow: true,
      status: 'active',
      diskUsageBytes: 52428800,
      errorMessage: null,
      lastAccessedAt: '2024-01-01T00:00:00',
      createdAt: '2024-01-01T00:00:00',
      updatedAt: '2024-01-01T00:00:00',
    })
  ),
  http.delete(`${API_BASE}/api/clusters/:clusterId/sandbox`, () =>
    new HttpResponse(null, { status: 202 })
  ),
  http.post(`${API_BASE}/api/clusters/:clusterId/sandbox/pull`, () =>
    HttpResponse.json({
      newCommit: 'def789abc012',
      anchorsAffected: { unchanged: 5, autoUpdated: 1, drifted: 0, orphaned: 0 },
    })
  ),
  http.post(`${API_BASE}/api/clusters/:clusterId/sandbox/checkout`, () =>
    HttpResponse.json({
      id: 'sandbox-1',
      status: 'active',
      currentBranch: 'develop',
      currentCommit: 'newcommit123',
    })
  ),
  http.get(`${API_BASE}/api/clusters/:clusterId/sandbox/branches`, () =>
    HttpResponse.json(['main', 'develop', 'feature/test'])
  ),
  http.get(`${API_BASE}/api/clusters/:clusterId/sandbox/tree`, () =>
    HttpResponse.json([
      { name: 'src', path: 'src', type: 'directory', size: null },
      { name: 'Main.java', path: 'src/Main.java', type: 'file', size: 1024 },
    ])
  ),
  http.get(`${API_BASE}/api/clusters/:clusterId/sandbox/file`, ({ request }) => {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || 'unknown';
    return HttpResponse.json({
      path,
      content: 'public class Main {}',
      language: 'java',
      size: 20,
    });
  }),
  http.post(`${API_BASE}/api/clusters/:clusterId/sandbox/retry`, ({ params }) =>
    HttpResponse.json(
      {
        id: 'sandbox-1',
        clusterId: params.clusterId,
        status: 'cloning',
        currentBranch: 'main',
        createdAt: '2024-01-01T00:00:00',
        updatedAt: '2024-01-01T00:00:00',
        lastAccessedAt: '2024-01-01T00:00:00',
      },
      { status: 202 }
    )
  ),
  http.get(`${API_BASE}/api/clusters/:clusterId/sandbox/log`, () =>
    HttpResponse.json([
      { sha: 'abc123', author: 'Dev', authorEmail: 'dev@test.com', date: '2024-01-01T00:00:00', message: 'Initial commit' },
    ])
  ),
  http.get(`${API_BASE}/api/clusters/:clusterId/sandbox/blame`, () =>
    HttpResponse.json([
      { line: 1, commitSha: 'abc123', author: 'Dev', date: '2024-01-01T00:00:00', content: 'line 1' },
    ])
  ),
  http.get(`${API_BASE}/api/clusters/:clusterId/sandbox/diff`, () =>
    HttpResponse.json('diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt')
  ),
  http.get(`${API_BASE}/api/sandboxes`, () =>
    HttpResponse.json([])
  ),

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
        questionCount: 5,
        hasQuestions: false,
        quizEligible: false,
        quizEnabled: true,
      },
      { status: 201 }
    )
  ),
  http.delete(`${API_BASE}/api/spaced-repetition/items/:neuronId`, () =>
    new HttpResponse(null, { status: 204 })
  ),
  http.get(`${API_BASE}/api/spaced-repetition/items/:itemId/questions`, () =>
    HttpResponse.json([])
  ),
];
