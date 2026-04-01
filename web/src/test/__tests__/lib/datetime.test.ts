import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeFuture } from '@/lib/datetime';

describe('formatRelativeFuture', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function setNow(date: Date) {
    vi.useFakeTimers();
    vi.setSystemTime(date);
  }

  const BASE = new Date('2025-06-01T12:00:00Z');

  it('returns "Now" for a past date', () => {
    setNow(BASE);
    const past = new Date(BASE.getTime() - 3600_000).toISOString(); // 1 hour ago
    expect(formatRelativeFuture(past)).toBe('Now');
  });

  it('returns "Now" for current time', () => {
    setNow(BASE);
    expect(formatRelativeFuture(BASE.toISOString())).toBe('Now');
  });

  it('returns "Now" for 30 seconds from now', () => {
    setNow(BASE);
    const future30s = new Date(BASE.getTime() + 30_000).toISOString();
    expect(formatRelativeFuture(future30s)).toBe('Now');
  });

  it('returns "in 1 minute" for 90 seconds from now', () => {
    setNow(BASE);
    const future90s = new Date(BASE.getTime() + 90_000).toISOString();
    expect(formatRelativeFuture(future90s)).toBe('in 1 minute');
  });

  it('returns "in 5 minutes" for 5 minutes from now', () => {
    setNow(BASE);
    const future5m = new Date(BASE.getTime() + 5 * 60_000).toISOString();
    expect(formatRelativeFuture(future5m)).toBe('in 5 minutes');
  });

  it('returns "in 59 minutes" for 59 minutes from now', () => {
    setNow(BASE);
    const future59m = new Date(BASE.getTime() + 59 * 60_000).toISOString();
    expect(formatRelativeFuture(future59m)).toBe('in 59 minutes');
  });

  it('returns "in 1 hour" for 60 minutes from now', () => {
    setNow(BASE);
    const future60m = new Date(BASE.getTime() + 60 * 60_000).toISOString();
    expect(formatRelativeFuture(future60m)).toBe('in 1 hour');
  });

  it('returns "in 23 hours" for 23 hours from now', () => {
    setNow(BASE);
    const future23h = new Date(BASE.getTime() + 23 * 3600_000).toISOString();
    expect(formatRelativeFuture(future23h)).toBe('in 23 hours');
  });

  it('returns "in 1 day" for 24 hours from now', () => {
    setNow(BASE);
    const future24h = new Date(BASE.getTime() + 24 * 3600_000).toISOString();
    expect(formatRelativeFuture(future24h)).toBe('in 1 day');
  });

  it('returns "in 29 days" for 29 days from now', () => {
    setNow(BASE);
    const future29d = new Date(BASE.getTime() + 29 * 24 * 3600_000).toISOString();
    expect(formatRelativeFuture(future29d)).toBe('in 29 days');
  });

  it('returns locale date string for 30+ days from now', () => {
    setNow(BASE);
    const future30d = new Date(BASE.getTime() + 30 * 24 * 3600_000).toISOString();
    const expected = new Date(future30d).toLocaleDateString();
    expect(formatRelativeFuture(future30d)).toBe(expected);
  });
});
