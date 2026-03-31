const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 1_000;

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * attempt));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const config: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      signal: controller.signal,
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
    list: (neuronId: string) =>
      request<import("@/types").Reminder[]>(`/api/neurons/${neuronId}/reminders`),
    create: (neuronId: string, body: {
      reminderType: string;
      triggerAt: string;
      recurrencePattern?: string | null;
      recurrenceInterval?: number | null;
    }) => request<import("@/types").Reminder>(`/api/neurons/${neuronId}/reminders`, { method: "POST", body }),
    update: (neuronId: string, reminderId: string, body: {
      reminderType: string;
      triggerAt: string;
      recurrencePattern?: string | null;
      recurrenceInterval?: number | null;
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
  },
};
