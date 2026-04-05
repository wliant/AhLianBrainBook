import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoTaskRow } from "@/components/todo/TodoTaskRow";
import type { Neuron, TodoMetadata } from "@/types";

// Mock next/link so <Link> renders a plain <a>
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

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

function makeMetadata(overrides: Partial<TodoMetadata> = {}): TodoMetadata {
  return {
    neuronId: "neuron-1",
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

describe("TodoTaskRow", () => {
  const defaultProps = {
    brainId: "brain-1",
    clusterId: "cluster-1",
    onToggleComplete: vi.fn(),
    onDelete: vi.fn(),
  };

  it("renders toggle button", () => {
    render(
      <TodoTaskRow
        neuron={makeNeuron()}
        metadata={makeMetadata()}
        {...defaultProps}
      />
    );

    expect(screen.getByTestId("todo-toggle-neuron-1")).toBeInTheDocument();
  });

  it("renders the neuron title", () => {
    render(
      <TodoTaskRow
        neuron={makeNeuron({ title: "My Task" })}
        metadata={makeMetadata()}
        {...defaultProps}
      />
    );

    expect(screen.getByText("My Task")).toBeInTheDocument();
  });

  it("renders priority badge for critical priority", () => {
    render(
      <TodoTaskRow
        neuron={makeNeuron()}
        metadata={makeMetadata({ priority: "critical" })}
        {...defaultProps}
      />
    );

    expect(screen.getByText("critical")).toBeInTheDocument();
  });

  it("renders priority badge for important priority", () => {
    render(
      <TodoTaskRow
        neuron={makeNeuron()}
        metadata={makeMetadata({ priority: "important" })}
        {...defaultProps}
      />
    );

    expect(screen.getByText("important")).toBeInTheDocument();
  });

  it("does not show priority badge for normal priority", () => {
    render(
      <TodoTaskRow
        neuron={makeNeuron()}
        metadata={makeMetadata({ priority: "normal" })}
        {...defaultProps}
      />
    );

    expect(screen.queryByText("normal")).not.toBeInTheDocument();
    expect(screen.queryByText("critical")).not.toBeInTheDocument();
    expect(screen.queryByText("important")).not.toBeInTheDocument();
  });

  it("renders effort label when set", () => {
    render(
      <TodoTaskRow
        neuron={makeNeuron()}
        metadata={makeMetadata({ effort: "2hr" })}
        {...defaultProps}
      />
    );

    expect(screen.getByText("2h")).toBeInTheDocument();
  });

  it("applies overdue styling for past due date", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const dueDateStr = yesterday.toISOString().split("T")[0];

    render(
      <TodoTaskRow
        neuron={makeNeuron()}
        metadata={makeMetadata({ dueDate: dueDateStr })}
        {...defaultProps}
      />
    );

    // Should show "Xd overdue" text
    expect(screen.getByText(/overdue/)).toBeInTheDocument();
  });

  it("shows 'Today' for tasks due today", () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    render(
      <TodoTaskRow
        neuron={makeNeuron()}
        metadata={makeMetadata({ dueDate: todayStr })}
        {...defaultProps}
      />
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("applies line-through and opacity for completed tasks", () => {
    const { container } = render(
      <TodoTaskRow
        neuron={makeNeuron({ title: "Completed Task" })}
        metadata={makeMetadata({ completed: true, completedAt: "2024-06-01T00:00:00" })}
        {...defaultProps}
      />
    );

    // The link should have line-through class
    const link = screen.getByText("Completed Task");
    expect(link.className).toContain("line-through");

    // The container should have opacity-50
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain("opacity-50");
  });

  it("calls onToggleComplete when toggle is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <TodoTaskRow
        neuron={makeNeuron()}
        metadata={makeMetadata({ completed: false })}
        {...defaultProps}
        onToggleComplete={onToggle}
      />
    );

    await user.click(screen.getByTestId("todo-toggle-neuron-1"));

    expect(onToggle).toHaveBeenCalledWith("neuron-1", true);
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <TodoTaskRow
        neuron={makeNeuron()}
        metadata={makeMetadata()}
        {...defaultProps}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByTitle("Delete task"));

    expect(onDelete).toHaveBeenCalledWith("neuron-1");
  });

  it("renders 'Untitled' for neuron with empty title", () => {
    render(
      <TodoTaskRow
        neuron={makeNeuron({ title: "" })}
        metadata={makeMetadata()}
        {...defaultProps}
      />
    );

    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("handles undefined metadata gracefully", () => {
    render(
      <TodoTaskRow
        neuron={makeNeuron()}
        metadata={undefined}
        {...defaultProps}
      />
    );

    // Should render without crashing, title visible
    expect(screen.getByText("Test Task")).toBeInTheDocument();
  });
});
