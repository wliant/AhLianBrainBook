import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiagramSection } from "@/components/sections/DiagramSection";
import type { Section } from "@/types";

function makeSection(content: Record<string, unknown> = {}): Section {
  return {
    id: "section-1",
    type: "diagram",
    order: 0,
    content: { source: "", diagramType: "mermaid", ...content },
    meta: {},
  };
}

describe("DiagramSection", () => {
  it("renders textarea in edit mode", () => {
    render(
      <DiagramSection
        section={makeSection({ source: "graph TD\n  A --> B" })}
        onUpdate={vi.fn()}
        editing={true}
      />
    );

    const textarea = screen.getByPlaceholderText(/graph TD/);
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("graph TD\n  A --> B");
  });

  it("renders 'Mermaid Diagram' label in edit mode", () => {
    render(
      <DiagramSection
        section={makeSection()}
        onUpdate={vi.fn()}
        editing={true}
      />
    );

    expect(screen.getByText("Mermaid Diagram")).toBeInTheDocument();
  });

  it("calls onUpdate when text changes", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <DiagramSection
        section={makeSection({ source: "" })}
        onUpdate={onUpdate}
        editing={true}
      />
    );

    const textarea = screen.getByPlaceholderText(/graph TD/);
    await user.type(textarea, "graph LR");

    expect(onUpdate).toHaveBeenCalled();
    // onUpdate should be called with source and diagramType
    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(lastCall).toHaveProperty("source");
    expect(lastCall).toHaveProperty("diagramType", "mermaid");
  });

  it("renders preview div in view mode with source", () => {
    const { container } = render(
      <DiagramSection
        section={makeSection({ source: "graph TD\n  A --> B" })}
        onUpdate={vi.fn()}
        editing={false}
      />
    );

    // In view mode, no textarea
    expect(screen.queryByPlaceholderText(/graph TD/)).not.toBeInTheDocument();
    // Should have the preview container
    expect(container.querySelector(".border.rounded-lg")).toBeInTheDocument();
  });

  it("renders 'Empty diagram' when source is empty in view mode", () => {
    render(
      <DiagramSection
        section={makeSection({ source: "" })}
        onUpdate={vi.fn()}
        editing={false}
      />
    );

    expect(screen.getByText("Empty diagram")).toBeInTheDocument();
  });

  it("defaults editing to true", () => {
    render(
      <DiagramSection
        section={makeSection({ source: "flowchart LR" })}
        onUpdate={vi.fn()}
      />
    );

    // When editing is not specified, defaults to true => shows textarea
    expect(screen.getByPlaceholderText(/graph TD/)).toBeInTheDocument();
  });
});
