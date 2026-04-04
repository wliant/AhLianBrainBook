const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 1_000;

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * attempt));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const config: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      signal: controller.signal,
      cache: method === "GET" ? "no-cache" as RequestCache : undefined,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE}${path}`, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        const err = new Error(error.error || error.message || `Request failed: ${response.status}`);

        // Only retry on 5xx server errors
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          lastError = err;
          continue;
        }
        throw err;
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const text = await response.text();
      if (!text) {
        return undefined as T;
      }

      return JSON.parse(text);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Only retry on fetch-level network errors (not HTTP errors or abort/timeout)
      const isAbort = lastError.name === "AbortError";
      const isFetchNetworkError = lastError instanceof TypeError;
      if (isFetchNetworkError && !isAbort && attempt < MAX_RETRIES) {
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.error || error.message || `Upload failed: ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, file: File) => uploadFile<T>(path, file),

  // Sandbox endpoints
  sandbox: {
    get: (clusterId: string) =>
      request<import("@/types").Sandbox>(`/api/clusters/${clusterId}/sandbox`),
    provision: (clusterId: string, body?: { branch?: string; shallow?: boolean }) =>
      request<import("@/types").Sandbox>(`/api/clusters/${clusterId}/sandbox`, { method: "POST", body }),
    terminate: (clusterId: string) =>
      request<void>(`/api/clusters/${clusterId}/sandbox`, { method: "DELETE" }),
    retry: (clusterId: string) =>
      request<import("@/types").Sandbox>(`/api/clusters/${clusterId}/sandbox/retry`, { method: "POST" }),
    pull: (clusterId: string) =>
      request<import("@/types").PullResponse>(`/api/clusters/${clusterId}/sandbox/pull`, { method: "POST" }),
    checkout: (clusterId: string, branch: string) =>
      request<import("@/types").Sandbox>(`/api/clusters/${clusterId}/sandbox/checkout`, { method: "POST", body: { branch } }),
    branches: (clusterId: string) =>
      request<string[]>(`/api/clusters/${clusterId}/sandbox/branches`),
    tree: (clusterId: string, path?: string) => {
      const params = path ? `?path=${encodeURIComponent(path)}` : "";
      return request<import("@/types").FileTreeEntry[]>(`/api/clusters/${clusterId}/sandbox/tree${params}`);
    },
    file: (clusterId: string, path: string) =>
      request<import("@/types").FileContent>(`/api/clusters/${clusterId}/sandbox/file?path=${encodeURIComponent(path)}`),
    log: (clusterId: string, limit = 50, offset = 0) =>
      request<import("@/types").GitCommit[]>(`/api/clusters/${clusterId}/sandbox/log?limit=${limit}&offset=${offset}`),
    blame: (clusterId: string, path: string) =>
      request<import("@/types").BlameLine[]>(`/api/clusters/${clusterId}/sandbox/blame?path=${encodeURIComponent(path)}`),
    diff: (clusterId: string, from: string, to: string) =>
      request<string>(`/api/clusters/${clusterId}/sandbox/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    list: () =>
      request<import("@/types").Sandbox[]>("/api/sandboxes"),
    structure: (clusterId: string, path: string) =>
      request<import("@/types").CodeStructureResponse>(`/api/clusters/${clusterId}/sandbox/structure?path=${encodeURIComponent(path)}`),
    definition: (clusterId: string, path: string, line: number, col: number) =>
      request<import("@/types").CodeDefinitionResponse>(`/api/clusters/${clusterId}/sandbox/definition?path=${encodeURIComponent(path)}&line=${line}&col=${col}`),
    references: (clusterId: string, path: string, line: number, col: number) =>
      request<import("@/types").CodeReferencesResponse>(`/api/clusters/${clusterId}/sandbox/references?path=${encodeURIComponent(path)}&line=${line}&col=${col}`),
  },

  // NeuronLink endpoints
  neuronLinks: {
    getForNeuron: <T>(neuronId: string) =>
      request<T>(`/api/neuron-links/neuron/${neuronId}`),
    getForBrain: <T>(brainId: string) =>
      request<T>(`/api/neuron-links/brain/${brainId}`),
    create: <T>(body: {
      sourceNeuronId: string;
      targetNeuronId: string;
      label?: string;
      linkType?: string;
      weight?: number;
    }) => request<T>("/api/neuron-links", { method: "POST", body }),
    delete: <T>(id: string) =>
      request<T>(`/api/neuron-links/${id}`, { method: "DELETE" }),
  },

  // LinkSuggestion endpoints
  linkSuggestions: {
    getForNeuron: (neuronId: string) =>
      request<import("@/types").LinkSuggestion[]>(`/api/link-suggestions/neuron/${neuronId}`),
    accept: (id: string) =>
      request<import("@/types").NeuronLink>(`/api/link-suggestions/${id}/accept`, { method: "POST" }),
  },

  // Thought endpoints
  thoughts: {
    list: () => request<import("@/types").Thought[]>("/api/thoughts"),
    get: (id: string) => request<import("@/types").Thought>(`/api/thoughts/${id}`),
    create: (body: {
      name: string;
      description?: string;
      neuronTagMode?: string;
      brainTagMode?: string;
      neuronTagIds: string[];
      brainTagIds?: string[];
    }) => request<import("@/types").Thought>("/api/thoughts", { method: "POST", body }),
    update: (id: string, body: {
      name: string;
      description?: string;
      neuronTagMode?: string;
      brainTagMode?: string;
      neuronTagIds: string[];
      brainTagIds?: string[];
    }) => request<import("@/types").Thought>(`/api/thoughts/${id}`, { method: "PATCH", body }),
    delete: (id: string) => request<void>(`/api/thoughts/${id}`, { method: "DELETE" }),
    neurons: (id: string) => request<import("@/types").Neuron[]>(`/api/thoughts/${id}/neurons`),
  },

  // Import/Export endpoints
  importExport: {
    exportBrain: <T>(brainId: string) =>
      request<T>(`/api/brains/${brainId}/export`),
    importBrain: <T>(body: { name: string; description?: string; clusters?: unknown[]; tags?: unknown[]; links?: unknown[] }) =>
      request<T>("/api/brains/import", { method: "POST", body }),
  },

  // Reminder endpoints
  reminders: {
    listAll: () =>
      request<import("@/types").Reminder[]>(`/api/reminders`),
    list: (neuronId: string) =>
      request<import("@/types").Reminder[]>(`/api/neurons/${neuronId}/reminders`),
    create: (neuronId: string, body: {
      reminderType: string;
      triggerAt: string;
      recurrencePattern?: string | null;
      recurrenceInterval?: number | null;
      title?: string | null;
      description?: string | null;
      descriptionText?: string | null;
    }) => request<import("@/types").Reminder>(`/api/neurons/${neuronId}/reminders`, { method: "POST", body }),
    update: (neuronId: string, reminderId: string, body: {
      reminderType: string;
      triggerAt: string;
      recurrencePattern?: string | null;
      recurrenceInterval?: number | null;
      title?: string | null;
      description?: string | null;
      descriptionText?: string | null;
    }) => request<import("@/types").Reminder>(`/api/neurons/${neuronId}/reminders/${reminderId}`, { method: "PUT", body }),
    delete: (neuronId: string, reminderId: string) =>
      request<void>(`/api/neurons/${neuronId}/reminders/${reminderId}`, { method: "DELETE" }),
  },

  // Revision endpoints
  revisions: {
    list: (neuronId: string) =>
      request<import("@/types").NeuronRevision[]>(`/api/neurons/${neuronId}/revisions`),
    get: (revisionId: string) =>
      request<import("@/types").NeuronRevision>(`/api/revisions/${revisionId}`),
    create: (neuronId: string) =>
      request<import("@/types").NeuronRevision>(`/api/neurons/${neuronId}/revisions`, { method: "POST" }),
    restore: (revisionId: string) =>
      request<import("@/types").Neuron>(`/api/revisions/${revisionId}/restore`, { method: "POST" }),
    delete: (revisionId: string) =>
      request<void>(`/api/revisions/${revisionId}`, { method: "DELETE" }),
  },

  // Settings endpoints
  settings: {
    get: () => request<import("@/types").AppSettings>("/api/settings"),
    update: (body: { displayName?: string; maxRemindersPerNeuron?: number }) =>
      request<import("@/types").AppSettings>("/api/settings", { method: "PATCH", body }),
  },

  // Notification endpoints
  notifications: {
    getAll: (page: number, size: number) =>
      request<import("@/types").AppNotification[]>(`/api/notifications?page=${page}&size=${size}`),
    getUnreadCount: () =>
      request<{ count: number }>("/api/notifications/unread/count"),
    markAsRead: (id: string) =>
      request<void>(`/api/notifications/${id}/read`, { method: "POST" }),
    markAllAsRead: () =>
      request<void>("/api/notifications/read-all", { method: "POST" }),
  },

  // Spaced Repetition endpoints
  spacedRepetition: {
    addItem: (neuronId: string) =>
      request<import("@/types").SpacedRepetitionItem>(`/api/spaced-repetition/items/${neuronId}`, { method: "POST" }),
    removeItem: (neuronId: string) =>
      request<void>(`/api/spaced-repetition/items/${neuronId}`, { method: "DELETE" }),
    getItem: (neuronId: string) =>
      request<import("@/types").SpacedRepetitionItem>(`/api/spaced-repetition/items/${neuronId}`),
    getAllItems: () =>
      request<import("@/types").SpacedRepetitionItem[]>("/api/spaced-repetition/items"),
    getQueue: () =>
      request<import("@/types").SpacedRepetitionItem[]>("/api/spaced-repetition/queue"),
    submitReview: (itemId: string, quality: number) =>
      request<import("@/types").SpacedRepetitionItem>(`/api/spaced-repetition/items/${itemId}/review`, {
        method: "POST",
        body: { quality },
      }),
    getQuestions: (itemId: string) =>
      request<import("@/types").ReviewQuestion[]>(`/api/spaced-repetition/items/${itemId}/questions`),
    regenerateQuestions: (itemId: string) =>
      request<void>(`/api/spaced-repetition/items/${itemId}/questions/regenerate`, { method: "POST" }),
    updateQuestionCount: (itemId: string, questionCount: number) =>
      request<import("@/types").SpacedRepetitionItem>(`/api/spaced-repetition/items/${itemId}/question-count`, {
        method: "PATCH",
        body: { questionCount },
      }),
    updateQuizEnabled: (itemId: string, quizEnabled: boolean) =>
      request<import("@/types").SpacedRepetitionItem>(`/api/spaced-repetition/items/${itemId}/quiz-enabled`, {
        method: "PATCH",
        body: { quizEnabled },
      }),
  },

  aiAssist: {
    invoke: (neuronId: string, sectionId: string, body: import("@/types").AiAssistRequest) =>
      request<import("@/types").AiAssistResponse>(
        `/api/neurons/${neuronId}/sections/${sectionId}/ai-assist`,
        { method: "POST", body, timeoutMs: 620_000 },
      ),
  },

  // Project Config endpoints
  projectConfig: {
    get: (clusterId: string) =>
      request<import("@/types").ProjectConfig>(`/api/clusters/${clusterId}/project-config`),
    update: (clusterId: string, body: { defaultBranch?: string }) =>
      request<import("@/types").ProjectConfig>(`/api/clusters/${clusterId}/project-config`, { method: "PATCH", body }),
  },

  // Browse endpoints (GitHub API proxy)
  browse: {
    tree: (clusterId: string, ref?: string) => {
      const params = ref ? `?ref=${encodeURIComponent(ref)}` : "";
      return request<import("@/types").FileTreeEntry[]>(`/api/clusters/${clusterId}/browse/tree${params}`);
    },
    file: (clusterId: string, path: string, ref?: string) => {
      const params = new URLSearchParams({ path });
      if (ref) params.set("ref", ref);
      return request<import("@/types").FileContent>(`/api/clusters/${clusterId}/browse/file?${params}`);
    },
    branches: (clusterId: string) =>
      request<{ name: string }[]>(`/api/clusters/${clusterId}/browse/branches`),
  },

  // Neuron Anchor endpoints
  neuronAnchors: {
    listByCluster: (clusterId: string, page = 0, size = 50) =>
      request<{ content: import("@/types").NeuronAnchor[]; totalElements: number }>(
        `/api/neuron-anchors/cluster/${clusterId}?page=${page}&size=${size}`
      ),
    listByFile: (clusterId: string, path: string, page = 0, size = 50) =>
      request<{ content: import("@/types").NeuronAnchor[]; totalElements: number }>(
        `/api/neuron-anchors/cluster/${clusterId}/file?path=${encodeURIComponent(path)}&page=${page}&size=${size}`
      ),
    create: (body: { neuronId: string; clusterId: string; filePath: string }) =>
      request<import("@/types").NeuronAnchor>("/api/neuron-anchors", { method: "POST", body }),
    update: (id: string, body: { filePath: string }) =>
      request<import("@/types").NeuronAnchor>(`/api/neuron-anchors/${id}`, { method: "PATCH", body }),
    delete: (id: string) =>
      request<void>(`/api/neuron-anchors/${id}`, { method: "DELETE" }),
  },

  researchTopics: {
    list: (clusterId: string) =>
      request<import("@/types").ResearchTopic[]>(`/api/clusters/${clusterId}/research-topics`),
    get: (clusterId: string, id: string) =>
      request<import("@/types").ResearchTopic>(`/api/clusters/${clusterId}/research-topics/${id}`),
    create: (clusterId: string, prompt?: string) =>
      request<import("@/types").ResearchTopic>(`/api/clusters/${clusterId}/research-topics`, {
        method: "POST",
        body: { prompt: prompt || null },
      }),
    delete: (clusterId: string, id: string) =>
      request<void>(`/api/clusters/${clusterId}/research-topics/${id}`, { method: "DELETE" }),
    reorder: (clusterId: string, ids: string[]) =>
      request<void>(`/api/clusters/${clusterId}/research-topics/reorder`, {
        method: "POST",
        body: { ids },
      }),
    update: (clusterId: string, id: string) =>
      request<import("@/types").ResearchTopic>(
        `/api/clusters/${clusterId}/research-topics/${id}/update`,
        { method: "POST" },
      ),
    updateAll: (clusterId: string) =>
      request<import("@/types").ResearchTopic[]>(
        `/api/clusters/${clusterId}/research-topics/update`,
        { method: "POST" },
      ),
    expand: (clusterId: string, id: string, bulletId: string) =>
      request<import("@/types").ResearchTopic>(
        `/api/clusters/${clusterId}/research-topics/${id}/expand`,
        { method: "POST", body: { bulletId }, timeoutMs: 620_000 },
      ),
  },
};
