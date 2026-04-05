import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResearchClusterView } from "@/components/research/ResearchClusterView";
import { server } from "../../../mocks/server";
import type { Cluster, ResearchTopic } from "@/types";

const API_BASE = "http://localhost:8080";

// Mock the SSE hook since it uses EventSource
vi.mock("@/lib/hooks/useResearchSse", () => ({
  useResearchSse: vi.fn(),
}));

function makeCluster(overrides: Partial<Cluster> = {}): Cluster {
  return {
    id: "cluster-1",
    brainId: "brain-1",
    name: "AI Research",
    type: "ai-research",
    status: "ready",
    researchGoal: "Understand transformers",
    sortOrder: 0,
    isArchived: false,
    createdAt: "2024-01-01T00:00:00",
    updatedAt: "2024-01-01T00:00:00",
    createdBy: "user",
    lastUpdatedBy: "user",
    ...overrides,
  };
}

function makeTopic(overrides: Partial<ResearchTopic> = {}): ResearchTopic {
  return {
    id: "topic-1",
    clusterId: "cluster-1",
    brainId: "brain-1",
    title: "Attention Mechanisms",
    prompt: "Explain attention",
    contentJson: { version: 1, items: [] },
    overallCompleteness: "partial",
    status: "ready",
    lastRefreshedAt: null,
    sortOrder: 0,
    createdAt: "2024-01-01T00:00:00",
    updatedAt: "2024-01-01T00:00:00",
    createdBy: "user",
    lastUpdatedBy: "user",
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

describe("ResearchClusterView", () => {
  it("renders the research-cluster-view testid", async () => {
    server.use(
      http.get(`${API_BASE}/api/clusters/cluster-1/research-topics`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/api/clusters/brain/brain-1`, () =>
        HttpResponse.json([makeCluster()])
      )
    );

    renderWithQueryClient(
      <ResearchClusterView cluster={makeCluster()} brainId="brain-1" />
    );

    expect(screen.getByTestId("research-cluster-view")).toBeInTheDocument();
  });

  it("renders research goal display", async () => {
    server.use(
      http.get(`${API_BASE}/api/clusters/cluster-1/research-topics`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/api/clusters/brain/brain-1`, () =>
        HttpResponse.json([makeCluster()])
      )
    );

    renderWithQueryClient(
      <ResearchClusterView
        cluster={makeCluster({ researchGoal: "Learn about LLMs" })}
        brainId="brain-1"
      />
    );

    expect(screen.getByText("Research Goal")).toBeInTheDocument();
    expect(screen.getByText("Learn about LLMs")).toBeInTheDocument();
  });

  it("renders topic cards when topics exist", async () => {
    const topics = [
      makeTopic({ id: "t-1", title: "Topic A" }),
      makeTopic({ id: "t-2", title: "Topic B" }),
    ];

    server.use(
      http.get(`${API_BASE}/api/clusters/cluster-1/research-topics`, () =>
        HttpResponse.json(topics)
      ),
      http.get(`${API_BASE}/api/clusters/brain/brain-1`, () =>
        HttpResponse.json([makeCluster()])
      )
    );

    renderWithQueryClient(
      <ResearchClusterView cluster={makeCluster()} brainId="brain-1" />
    );

    await waitFor(() => {
      expect(screen.getByText("Topic A")).toBeInTheDocument();
    });
    expect(screen.getByText("Topic B")).toBeInTheDocument();
  });

  it("renders 'New Topic' button", async () => {
    server.use(
      http.get(`${API_BASE}/api/clusters/cluster-1/research-topics`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/api/clusters/brain/brain-1`, () =>
        HttpResponse.json([makeCluster()])
      )
    );

    renderWithQueryClient(
      <ResearchClusterView cluster={makeCluster()} brainId="brain-1" />
    );

    expect(screen.getByTestId("new-research-topic-btn")).toBeInTheDocument();
    expect(screen.getByText("New Topic")).toBeInTheDocument();
  });

  it("renders 'Update All' button", async () => {
    server.use(
      http.get(`${API_BASE}/api/clusters/cluster-1/research-topics`, () =>
        HttpResponse.json([makeTopic()])
      ),
      http.get(`${API_BASE}/api/clusters/brain/brain-1`, () =>
        HttpResponse.json([makeCluster()])
      )
    );

    renderWithQueryClient(
      <ResearchClusterView cluster={makeCluster()} brainId="brain-1" />
    );

    await waitFor(() => {
      expect(screen.getByText("Update All")).toBeInTheDocument();
    });
  });

  it("renders empty state when no topics", async () => {
    server.use(
      http.get(`${API_BASE}/api/clusters/cluster-1/research-topics`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/api/clusters/brain/brain-1`, () =>
        HttpResponse.json([makeCluster()])
      )
    );

    renderWithQueryClient(
      <ResearchClusterView cluster={makeCluster()} brainId="brain-1" />
    );

    await waitFor(() => {
      expect(screen.getByText("No research topics yet.")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Create one to have AI map out what you should learn.")
    ).toBeInTheDocument();
  });

  it("shows placeholder text when no research goal", async () => {
    server.use(
      http.get(`${API_BASE}/api/clusters/cluster-1/research-topics`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/api/clusters/brain/brain-1`, () =>
        HttpResponse.json([makeCluster({ researchGoal: null })])
      )
    );

    renderWithQueryClient(
      <ResearchClusterView
        cluster={makeCluster({ researchGoal: null })}
        brainId="brain-1"
      />
    );

    expect(
      screen.getByText("Click to set research goal...")
    ).toBeInTheDocument();
  });

  it("shows generating indicator when cluster is generating", async () => {
    server.use(
      http.get(`${API_BASE}/api/clusters/cluster-1/research-topics`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/api/clusters/brain/brain-1`, () =>
        HttpResponse.json([makeCluster({ status: "generating" })])
      )
    );

    renderWithQueryClient(
      <ResearchClusterView
        cluster={makeCluster({ status: "generating" })}
        brainId="brain-1"
      />
    );

    expect(screen.getByText("Generating research goal...")).toBeInTheDocument();
  });

  it("disables 'New Topic' button when generating", async () => {
    server.use(
      http.get(`${API_BASE}/api/clusters/cluster-1/research-topics`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/api/clusters/brain/brain-1`, () =>
        HttpResponse.json([makeCluster({ status: "generating" })])
      )
    );

    renderWithQueryClient(
      <ResearchClusterView
        cluster={makeCluster({ status: "generating" })}
        brainId="brain-1"
      />
    );

    expect(screen.getByTestId("new-research-topic-btn")).toBeDisabled();
  });

  it("opens research goal editing on click", async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${API_BASE}/api/clusters/cluster-1/research-topics`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/api/clusters/brain/brain-1`, () =>
        HttpResponse.json([makeCluster()])
      )
    );

    renderWithQueryClient(
      <ResearchClusterView
        cluster={makeCluster({ researchGoal: "My goal" })}
        brainId="brain-1"
      />
    );

    await user.click(screen.getByTestId("research-goal-display"));

    await waitFor(() => {
      expect(screen.getByTestId("research-goal-input")).toBeInTheDocument();
    });
  });

  it("renders 'Research Topics' heading", async () => {
    server.use(
      http.get(`${API_BASE}/api/clusters/cluster-1/research-topics`, () =>
        HttpResponse.json([])
      ),
      http.get(`${API_BASE}/api/clusters/brain/brain-1`, () =>
        HttpResponse.json([makeCluster()])
      )
    );

    renderWithQueryClient(
      <ResearchClusterView cluster={makeCluster()} brainId="brain-1" />
    );

    expect(screen.getByText("Research Topics")).toBeInTheDocument();
  });
});
