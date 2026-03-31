import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "@/components/CommandPalette";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next-themes
const mockSetTheme = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: mockSetTheme, theme: "light" }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Seed brains into cache
  queryClient.setQueryData(["brains"], [
    { id: "b1", name: "Test Brain", icon: null, color: null },
  ]);
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSetTheme.mockClear();
  });

  it("opens when toggle-command-palette event is dispatched", async () => {
    render(<CommandPalette />, { wrapper: createWrapper() });

    // Should not be visible initially
    expect(screen.queryByTestId("command-palette-input")).not.toBeInTheDocument();

    // Dispatch custom event to open
    act(() => {
      window.dispatchEvent(new CustomEvent("toggle-command-palette"));
    });

    expect(screen.getByTestId("command-palette-input")).toBeInTheDocument();
  });

  it("shows navigation items", async () => {
    render(<CommandPalette />, { wrapper: createWrapper() });

    act(() => {
      window.dispatchEvent(new CustomEvent("toggle-command-palette"));
    });

    expect(screen.getByTestId("cmd-nav-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("cmd-nav-search")).toBeInTheDocument();
    expect(screen.getByTestId("cmd-nav-settings")).toBeInTheDocument();
  });

  it("shows brains from React Query cache", async () => {
    render(<CommandPalette />, { wrapper: createWrapper() });

    act(() => {
      window.dispatchEvent(new CustomEvent("toggle-command-palette"));
    });

    expect(screen.getByTestId("cmd-brain-b1")).toBeInTheDocument();
    expect(screen.getByText("Test Brain")).toBeInTheDocument();
  });

  it("navigates to page on select", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />, { wrapper: createWrapper() });

    act(() => {
      window.dispatchEvent(new CustomEvent("toggle-command-palette"));
    });

    await user.click(screen.getByTestId("cmd-nav-settings"));
    expect(mockPush).toHaveBeenCalledWith("/settings");
  });
});
