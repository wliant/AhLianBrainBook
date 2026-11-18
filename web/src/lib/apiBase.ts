/**
 * Base URL every request to the backend is prefixed with.
 *
 * `??` rather than `||` on purpose: the deployed images are built with
 * NEXT_PUBLIC_API_URL="" so the browser reaches the API same-origin, through
 * the nginx edge that also serves this app. An empty string is falsy, so `||`
 * would silently send production traffic to localhost:8080.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
