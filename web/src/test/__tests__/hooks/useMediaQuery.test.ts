import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

type Listener = (event: MediaQueryListEvent) => void;

function createMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initialMatches,
    media: "",
    addEventListener: vi.fn((_: string, listener: Listener) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_: string, listener: Listener) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  } as unknown as MediaQueryList;

  const fire = (matches: boolean) => {
    (mql as { matches: boolean }).matches = matches;
    listeners.forEach((l) => l({ matches } as MediaQueryListEvent));
  };

  return { mql, fire, listeners };
}

describe("useMediaQuery", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns the initial matches value", () => {
    const { mql } = createMatchMedia(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));

    expect(result.current).toBe(true);
  });

  it("updates when the media query changes", () => {
    const { mql, fire } = createMatchMedia(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(result.current).toBe(false);

    act(() => fire(true));
    expect(result.current).toBe(true);
  });

  it("removes its listener on unmount", () => {
    const { mql, listeners } = createMatchMedia(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { unmount } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(listeners.size).toBe(1);

    unmount();
    expect(listeners.size).toBe(0);
  });
});
