import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MathSection } from "@/components/sections/MathSection";
import type { Section } from "@/types";

function makeSection(content: Record<string, unknown> = {}): Section {
  return {
    id: "section-1",
    type: "math",
    order: 0,
    content: { latex: "", ...content },
    meta: {},
  };
}

describe("MathSection", () => {
  it("renders textarea in edit mode", () => {
    render(
      <MathSection
        section={makeSection({ latex: "E = mc^2" })}
        onUpdate={vi.fn()}
        editing={true}
      />
    );

    const textarea = screen.getByPlaceholderText(/Enter LaTeX expression/);
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("E = mc^2");
  });

  it("renders LaTeX label header in edit mode", () => {
    render(
      <MathSection
        section={makeSection()}
        onUpdate={vi.fn()}
        editing={true}
      />
    );

    expect(screen.getByText("LaTeX")).toBeInTheDocument();
  });

  it("calls onUpdate when text changes in edit mode", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <MathSection
        section={makeSection({ latex: "" })}
        onUpdate={onUpdate}
        editing={true}
      />
    );

    const textarea = screen.getByPlaceholderText(/Enter LaTeX expression/);
    await user.type(textarea, "x");

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ latex: "x" });
  });

  it("renders preview div in view mode with latex", () => {
    const { container } = render(
      <MathSection
        section={makeSection({ latex: "E = mc^2" })}
        onUpdate={vi.fn()}
        editing={false}
      />
    );

    // In view mode, there should be a preview div (rendered by ref)
    expect(screen.queryByPlaceholderText(/Enter LaTeX expression/)).not.toBeInTheDocument();
    // Container should have the border/rounded-lg wrapper
    expect(container.querySelector(".border.rounded-lg")).toBeInTheDocument();
  });

  it("renders 'Empty math block' when latex is empty in view mode", () => {
    render(
      <MathSection
        section={makeSection({ latex: "" })}
        onUpdate={vi.fn()}
        editing={false}
      />
    );

    expect(screen.getByText("Empty math block")).toBeInTheDocument();
  });

  it("defaults editing to true", () => {
    render(
      <MathSection
        section={makeSection({ latex: "\\pi" })}
        onUpdate={vi.fn()}
      />
    );

    // When editing is not specified, defaults to true => shows textarea
    expect(screen.getByPlaceholderText(/Enter LaTeX expression/)).toBeInTheDocument();
  });
});
