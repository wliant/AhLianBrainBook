/**
 * Convert a UTC ISO string to a local datetime-local input value.
 */
export function utcToLocalDatetimeString(utcIso: string): string {
  const date = new Date(utcIso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

/**
 * Convert a local datetime-local input value to a UTC ISO string.
 */
export function localDatetimeToUTCIso(localDatetime: string): string {
  return new Date(localDatetime).toISOString();
}

/**
 * Get the minimum datetime-local value (now) for form inputs.
 */
export function getMinDatetimeLocal(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

/**
 * Format a date string as relative time (e.g., "5m ago").
 */
export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Format a future date string as relative time (e.g., "in 3 days").
 * Returns "Now" if the date is in the past or within the current minute.
 */
export function formatRelativeFuture(dateStr: string): string {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  const diff = target - now;

  if (diff <= 60_000) return "Now";

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `in ${minutes} minute${minutes !== 1 ? "s" : ""}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours} hour${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `in ${days} day${days !== 1 ? "s" : ""}`;
  return new Date(dateStr).toLocaleDateString();
}
