import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TodoClusterView } from "@/components/todo/TodoClusterView";
import { server } from "../../../mocks/server";
import type { Cluster, Neuron, TodoMetadata } from "@/types";

const API_BASE = "http://localhost:8080";

// Mock next/link so <Link> renders a plain <a>
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function makeCluster(overrides: Partial<Cluster> = {}): Cluster {
  return {
    id: "cluster-1",
    brainId: "brain-1",
    name: "Todo Cluster",
    type: "todo",
    status: "ready",
    researchGoal: null,
    sortOrder: 0,
    isArchived: false,
    createdAt: "2024-01-01T00:00:00",
    updatedAt: "2024-01-01T00:00:00",
    createdBy: "user",
    lastUpdatedBy: "user",
    ...overrides,
  };
}

function makeNeuron(overrides: Partial<Neuron> = {}): Neuron {
  return {
    id: "neuron-1",
    brainId: "brain-1",
    clusterId: "cluster-1",
    title: "Test Task",
    contentJson: null,
    contentText: null,
    templateId: null,
    isArchived: false,
    isDeleted: false,
    isFavorite: false,
    isPinned: false,
    version: 1,
    complexity: null,
    createdAt: "2024-01-01T00:00:00",
    updatedAt: "2024-01-01T00:00:00",
    createdBy: "user",
    lastUpdatedBy: "user",
    lastEditedAt: "2024-01-01T00:00:00",
    tags: [],
    anchor: null,
    ...overrides,
  };
}

function makeMetadata(neuronId: string, overrides: Partial<TodoMetadata> = {}): TodoMetadata {
  return {
    neuronId,
    dueDate: null,
    completed: false,
    completedAt: null,
    effort: null,
    priority: "normal",
    createdAt: "2024-01-01T00:00:00",
    updatedAt: "2024-01-01T00:00:00",
    ...overrides,
  };
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("TodoClusterView", () => {
  it("renders quick-add input", async () => {
    server.use(
      http.get(`${API_BASE}/api/neurons/cluster/cluster-1`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/api/clusters/cluster-1/todo`, () =>
        HttpResponse.json({})
      )
    );

    renderWithQueryClient(
      <TodoClusterView cluster={makeCluster()} brainId="brain-1" />
    );

    expect(screen.getByTestId("todo-quick-add")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add a task...")).toBeInTheDocument();
  });

  it("renders task rows for each neuron", async () => {
    const neurons = [
      makeNeuron({ id: "n-1", title: "Task One" }),
      makeNeuron({ id: "n-2", title: "Task Two" }),
    ];
    const metadataMap: Record<string, TodoMetadata> = {
      "n-1": makeMetadata("n-1"),
      "n-2": makeMetadata("n-2"),
    };

    server.use(
      http.get(`${API_BASE}/api/neurons/cluster/cluster-1`, () =>
        HttpResponse.json(neurons)
      ),
      http.get(`${API_BASE}/api/clusters/cluster-1/todo`, () =>
        HttpResponse.json(metadataMap)
      )
    );

    renderWithQueryClient(
      <TodoClusterView cluster={makeCluster()} brainId="brain-1" />
    );

    await waitFor(() => {
      expect(screen.getByText("Task One")).toBeInTheDocument();
    });
    expect(screen.getByText("Task Two")).toBeInTheDocument();
  });

  it("sorts incomplete tasks before completed", async () => {
    const neurons = [
      makeNeuron({ id: "n-1", title: "Completed Task" }),
      makeNeuron({ id: "n-2", title: "Incomplete Task" }),
    ];
    const metadataMap: Record<string, TodoMetadata> = {
      "n-1": makeMetadata("n-1", { completed: true, completedAt: "2024-06-01T00:00:00" }),
      "n-2": makeMetadata("n-2", { completed: false }),
    };

    server.use(
      http.get(`${API_BASE}/api/neurons/cluster/cluster-1`, () =>
        HttpResponse.json(neurons)
      ),
      http.get(`${API_BASE}/api/clusters/cluster-1/todo`, () =>
        HttpResponse.json(metadataMap)
      )
    );

    renderWithQueryClient(
      <TodoClusterView cluster={makeCluster()} brainId="brain-1" />
    );

    // Only incomplete is shown by default (completed hidden)
    await waitFor(() => {
      expect(screen.getByText("Incomplete Task")).toBeInTheDocument();
    });
    expect(screen.queryByText("Completed Task")).not.toBeInTheDocument();
  });

  it("hides completed tasks by default", async () => {
    const neurons = [
      makeNeuron({ id: "n-1", title: "Done Task" }),
      makeNeuron({ id: "n-2", title: "Open Task" }),
    ];
    const metadataMap: Record<string, TodoMetadata> = {
      "n-1": makeMetadata("n-1", { completed: true, completedAt: "2024-06-01T00:00:00" }),
      "n-2": makeMetadata("n-2"),
    };

    server.use(
      http.get(`${API_BASE}/api/neurons/cluster/cluster-1`, () =>
        HttpResponse.json(neurons)
      ),
      http.get(`${API_BASE}/api/clusters/cluster-1/todo`, () =>
        HttpResponse.json(metadataMap)
      )
    );

    renderWithQueryClient(
      <TodoClusterView cluster={makeCluster()} brainId="brain-1" />
    );

    await waitFor(() => {
      expect(screen.getByText("Open Task")).toBeInTheDocument();
    });
    expect(screen.queryByText("Done Task")).not.toBeInTheDocument();

    // The button should say "Show completed (1)"
    expect(screen.getByText(/Show completed/)).toBeInTheDocument();
  });

  it("shows completed tasks when toggled", async () => {
    const user = userEvent.setup();

    const neurons = [
      makeNeuron({ id: "n-1", title: "Done Task" }),
      makeNeuron({ id: "n-2", title: "Open Task" }),
    ];
    const metadataMap: Record<string, TodoMetadata> = {
      "n-1": makeMetadata("n-1", { completed: true, completedAt: "2024-06-01T00:00:00" }),
      "n-2": makeMetadata("n-2"),
    };

    server.use(
      http.get(`${API_BASE}/api/neurons/cluster/cluster-1`, () =>
        HttpResponse.json(neurons)
      ),
      http.get(`${API_BASE}/api/clusters/cluster-1/todo`, () =>
        HttpResponse.json(metadataMap)
      )
    );

    renderWithQueryClient(
      <TodoClusterView cluster={makeCluster()} brainId="brain-1" />
    );

    await waitFor(() => {
      expect(screen.getByText("Open Task")).toBeInTheDocument();
    });

    // Click to show completed
    await user.click(screen.getByText(/Show completed/));

    await waitFor(() => {
      expect(screen.getByText("Done Task")).toBeInTheDocument();
    });
    expect(screen.getByText("Open Task")).toBeInTheDocument();
  });

  it("shows empty state when no tasks exist", async () => {
    server.use(
      http.get(`${API_BASE}/api/neurons/cluster/cluster-1`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/api/clusters/cluster-1/todo`, () =>
        HttpResponse.json({})
      )
    );

    renderWithQueryClient(
      <TodoClusterView cluster={makeCluster()} brainId="brain-1" />
    );

    await waitFor(() => {
      expect(screen.getByText("No tasks yet. Add one above.")).toBeInTheDocument();
    });
  });
});
