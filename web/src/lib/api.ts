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
};
