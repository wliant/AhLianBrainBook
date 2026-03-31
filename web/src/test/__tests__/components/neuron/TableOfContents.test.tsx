import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TableOfContents } from "@/components/neuron/TableOfContents";
import type { SectionsDocument } from "@/types";

const mockDoc: SectionsDocument = {
  version: 2,
  sections: [
    {
      id: "sec-1",
      type: "rich-text",
      order: 0,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Introduction" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Some text" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Background" }],
          },
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Details" }],
          },
        ],
      },
      meta: {},
    },
    {
      id: "sec-2",
      type: "code",
      order: 1,
      content: { code: "console.log('hi')", language: "javascript" },
      meta: {},
    },
    {
      id: "sec-3",
      type: "rich-text",
      order: 2,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Conclusion" }],
          },
        ],
      },
      meta: {},
    },
  ],
};

const emptyDoc: SectionsDocument = {
  version: 2,
  sections: [
    {
      id: "sec-1",
      type: "rich-text",
      order: 0,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "No headings here" }],
          },
        ],
      },
      meta: {},
    },
  ],
};

describe("TableOfContents", () => {
  it("renders headings from rich-text sections", () => {
    render(<TableOfContents document={mockDoc} onClose={vi.fn()} />);

    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Background")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Conclusion")).toBeInTheDocument();
  });

  it("ignores non-rich-text sections", () => {
    render(<TableOfContents document={mockDoc} onClose={vi.fn()} />);

    // Should have exactly 4 heading buttons (not code section content)
    const buttons = screen.getAllByRole("button").filter(
      (b) => !b.querySelector("svg") // exclude close button which has an SVG icon
    );
    expect(buttons).toHaveLength(4);
  });

  it("shows empty state when no headings exist", () => {
    render(<TableOfContents document={emptyDoc} onClose={vi.fn()} />);

    expect(screen.getByText(/No headings found/)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<TableOfContents document={mockDoc} onClose={onClose} />);

    // The close button is in the header, has an X icon
    const closeButton = screen.getByTestId("toc-panel").querySelector(
      ".border-b button"
    ) as HTMLElement;
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders with correct panel structure", () => {
    render(<TableOfContents document={mockDoc} onClose={vi.fn()} />);

    expect(screen.getByTestId("toc-panel")).toBeInTheDocument();
    expect(screen.getByText("Table of Contents")).toBeInTheDocument();
  });
});
