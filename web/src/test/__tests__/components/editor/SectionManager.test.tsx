import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SectionWrapper } from "@/components/sections/SectionWrapper";
import type { Section } from "@/types";

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: "section-1",
    type: "code",
    order: 0,
    content: { code: "console.log('hi')", language: "javascript" },
    meta: {},
    ...overrides,
  };
}

describe("SectionWrapper (section management controls)", () => {
  const mockOnMoveUp = vi.fn();
  const mockOnMoveDown = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnTogglePreview = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders child content", () => {
    render(
      <SectionWrapper
        section={makeSection()}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      >
        <div data-testid="child-content">Hello</div>
      </SectionWrapper>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders move up button", () => {
    render(
      <SectionWrapper
        section={makeSection()}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.getByTitle("Move up")).toBeInTheDocument();
  });

  it("renders move down button", () => {
    render(
      <SectionWrapper
        section={makeSection()}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.getByTitle("Move down")).toBeInTheDocument();
  });

  it("renders delete button", () => {
    render(
      <SectionWrapper
        section={makeSection()}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.getByTitle("Delete section")).toBeInTheDocument();
  });

  it("disables move up when first section", () => {
    render(
      <SectionWrapper
        section={makeSection()}
        isFirst={true}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.getByTitle("Move up")).toBeDisabled();
  });

  it("disables move down when last section", () => {
    render(
      <SectionWrapper
        section={makeSection()}
        isFirst={false}
        isLast={true}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.getByTitle("Move down")).toBeDisabled();
  });

  it("calls onMoveUp when move up button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <SectionWrapper
        section={makeSection()}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    await user.click(screen.getByTitle("Move up"));

    expect(mockOnMoveUp).toHaveBeenCalledTimes(1);
  });

  it("calls onMoveDown when move down button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <SectionWrapper
        section={makeSection()}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    await user.click(screen.getByTitle("Move down"));

    expect(mockOnMoveDown).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <SectionWrapper
        section={makeSection()}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    await user.click(screen.getByTitle("Delete section"));

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it("renders toggle preview button when onTogglePreview is provided", () => {
    render(
      <SectionWrapper
        section={makeSection()}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
        onTogglePreview={mockOnTogglePreview}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.getByTitle("Switch to Preview")).toBeInTheDocument();
  });

  it("shows 'Switch to Edit' when section is in preview mode", () => {
    render(
      <SectionWrapper
        section={makeSection({ meta: { preview: true } })}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
        onTogglePreview={mockOnTogglePreview}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.getByTitle("Switch to Edit")).toBeInTheDocument();
  });

  it("hides controls in view mode", () => {
    render(
      <SectionWrapper
        section={makeSection()}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
        viewMode={true}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.queryByTitle("Move up")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Move down")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Delete section")).not.toBeInTheDocument();
  });

  it("hides controls when section is locked", () => {
    render(
      <SectionWrapper
        section={makeSection({ meta: { locked: true } })}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.queryByTitle("Move up")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Delete section")).not.toBeInTheDocument();
  });

  it("renders AI assist button when onAiAssist is provided", () => {
    render(
      <SectionWrapper
        section={makeSection()}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
        onAiAssist={vi.fn()}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.getByTestId("ai-assist-btn")).toBeInTheDocument();
  });

  it("renders section type label for non-rich-text, non-divider sections", () => {
    render(
      <SectionWrapper
        section={makeSection({ type: "code" })}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.getByText("Code")).toBeInTheDocument();
  });

  it("does not render section type label for divider", () => {
    render(
      <SectionWrapper
        section={makeSection({ type: "divider" })}
        isFirst={false}
        isLast={false}
        onMoveUp={mockOnMoveUp}
        onMoveDown={mockOnMoveDown}
        onDelete={mockOnDelete}
      >
        <div>Content</div>
      </SectionWrapper>
    );

    expect(screen.queryByText("Divider")).not.toBeInTheDocument();
  });
});
