import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoMetadataEditor } from "@/components/todo/TodoMetadataEditor";
import type { TodoMetadata } from "@/types";

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

describe("TodoMetadataEditor", () => {
  it("renders the editor container", () => {
    render(
      <TodoMetadataEditor metadata={makeMetadata()} onUpdate={vi.fn()} />
    );

    expect(screen.getByTestId("todo-metadata-editor")).toBeInTheDocument();
  });

  it("renders completion toggle", () => {
    render(
      <TodoMetadataEditor metadata={makeMetadata()} onUpdate={vi.fn()} />
    );

    expect(screen.getByTitle("Mark complete")).toBeInTheDocument();
  });

  it("renders 'Mark incomplete' title when completed", () => {
    render(
      <TodoMetadataEditor
        metadata={makeMetadata({ completed: true, completedAt: "2024-06-01T00:00:00" })}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByTitle("Mark incomplete")).toBeInTheDocument();
  });

  it("renders due date input", () => {
    render(
      <TodoMetadataEditor metadata={makeMetadata()} onUpdate={vi.fn()} />
    );

    expect(screen.getByText("Due:")).toBeInTheDocument();
    const dateInput = screen.getByDisplayValue("");
    expect(dateInput).toHaveAttribute("type", "date");
  });

  it("renders due date with value when set", () => {
    render(
      <TodoMetadataEditor
        metadata={makeMetadata({ dueDate: "2024-12-25" })}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("2024-12-25")).toBeInTheDocument();
  });

  it("renders priority dropdown with current value", () => {
    render(
      <TodoMetadataEditor
        metadata={makeMetadata({ priority: "critical" })}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText("Priority:")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Critical")).toBeInTheDocument();
  });

  it("renders effort dropdown", () => {
    render(
      <TodoMetadataEditor metadata={makeMetadata()} onUpdate={vi.fn()} />
    );

    expect(screen.getByText("Effort:")).toBeInTheDocument();
  });

  it("renders all priority options", () => {
    render(
      <TodoMetadataEditor metadata={makeMetadata()} onUpdate={vi.fn()} />
    );

    const prioritySelect = screen.getByDisplayValue("Normal");
    expect(prioritySelect).toBeInTheDocument();

    // Check all options exist
    const options = prioritySelect.querySelectorAll("option");
    const values = Array.from(options).map((o) => o.value);
    expect(values).toEqual(["critical", "important", "normal"]);
  });

  it("renders all effort options", () => {
    render(
      <TodoMetadataEditor metadata={makeMetadata()} onUpdate={vi.fn()} />
    );

    // The effort select has a "---" option plus the effort values
    const effortLabel = screen.getByText("Effort:");
    const effortSelect = effortLabel.parentElement!.querySelector("select")!;
    const options = effortSelect.querySelectorAll("option");
    // First is empty/dash, then 6 effort options
    expect(options.length).toBe(7);
  });

  it("calls onUpdate when completion is toggled", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <TodoMetadataEditor
        metadata={makeMetadata({ completed: false })}
        onUpdate={onUpdate}
      />
    );

    await user.click(screen.getByTitle("Mark complete"));

    expect(onUpdate).toHaveBeenCalledWith({ completed: true });
  });

  it("calls onUpdate when priority changes", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <TodoMetadataEditor
        metadata={makeMetadata({ priority: "normal" })}
        onUpdate={onUpdate}
      />
    );

    const prioritySelect = screen.getByDisplayValue("Normal");
    await user.selectOptions(prioritySelect, "critical");

    expect(onUpdate).toHaveBeenCalledWith({ priority: "critical" });
  });

  it("calls onUpdate when due date changes", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <TodoMetadataEditor metadata={makeMetadata()} onUpdate={onUpdate} />
    );

    const dateInputs = document.querySelectorAll('input[type="date"]');
    const dateInput = dateInputs[0] as HTMLInputElement;
    await user.clear(dateInput);
    await user.type(dateInput, "2025-03-15");

    expect(onUpdate).toHaveBeenCalled();
  });

  it("calls onUpdate when effort changes", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <TodoMetadataEditor metadata={makeMetadata()} onUpdate={onUpdate} />
    );

    const effortLabel = screen.getByText("Effort:");
    const effortSelect = effortLabel.parentElement!.querySelector("select")!;
    await user.selectOptions(effortSelect, "2hr");

    expect(onUpdate).toHaveBeenCalledWith({ effort: "2hr" });
  });

  it("shows completed at date when completed", () => {
    render(
      <TodoMetadataEditor
        metadata={makeMetadata({
          completed: true,
          completedAt: "2024-06-15T10:30:00",
        })}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText(/Completed/)).toBeInTheDocument();
  });

  it("does not show completed at date when not completed", () => {
    render(
      <TodoMetadataEditor metadata={makeMetadata()} onUpdate={vi.fn()} />
    );

    expect(screen.queryByText(/Completed \d/)).not.toBeInTheDocument();
  });
});
