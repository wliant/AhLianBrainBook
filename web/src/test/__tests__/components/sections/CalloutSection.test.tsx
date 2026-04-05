import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalloutSection } from "@/components/sections/CalloutSection";
import type { Section } from "@/types";

function makeSection(content: Record<string, unknown> = {}): Section {
  return {
    id: "section-1",
    type: "callout",
    order: 0,
    content: { variant: "info", text: "", ...content },
    meta: {},
  };
}

describe("CalloutSection", () => {
  describe("variant rendering in view mode", () => {
    it("renders Info variant label", () => {
      render(
        <CalloutSection
          section={makeSection({ variant: "info", text: "Info text" })}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      expect(screen.getByText("Info")).toBeInTheDocument();
      expect(screen.getByText("Info text")).toBeInTheDocument();
    });

    it("renders Warning variant label", () => {
      render(
        <CalloutSection
          section={makeSection({ variant: "warning", text: "Warning text" })}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      expect(screen.getByText("Warning")).toBeInTheDocument();
      expect(screen.getByText("Warning text")).toBeInTheDocument();
    });

    it("renders Tip variant label", () => {
      render(
        <CalloutSection
          section={makeSection({ variant: "tip", text: "Tip text" })}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      expect(screen.getByText("Tip")).toBeInTheDocument();
      expect(screen.getByText("Tip text")).toBeInTheDocument();
    });

    it("renders Note variant label", () => {
      render(
        <CalloutSection
          section={makeSection({ variant: "note", text: "Note text" })}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      expect(screen.getByText("Note")).toBeInTheDocument();
      expect(screen.getByText("Note text")).toBeInTheDocument();
    });
  });

  describe("view mode", () => {
    it("renders text as paragraph, not textarea", () => {
      render(
        <CalloutSection
          section={makeSection({ variant: "info", text: "Some content" })}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      expect(screen.getByText("Some content")).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("shows 'Empty callout' when text is empty", () => {
      render(
        <CalloutSection
          section={makeSection({ variant: "info", text: "" })}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      expect(screen.getByText("Empty callout")).toBeInTheDocument();
    });

    it("does not render variant dropdown in view mode", () => {
      render(
        <CalloutSection
          section={makeSection({ variant: "info", text: "Test" })}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      // No select elements in view mode
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    it("renders textarea for text editing", () => {
      render(
        <CalloutSection
          section={makeSection({ variant: "info", text: "Editable" })}
          onUpdate={vi.fn()}
          editing={true}
        />
      );

      const textarea = screen.getByPlaceholderText("Info...");
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue("Editable");
    });

    it("renders variant dropdown in edit mode", () => {
      render(
        <CalloutSection
          section={makeSection({ variant: "info", text: "" })}
          onUpdate={vi.fn()}
          editing={true}
        />
      );

      expect(screen.getByDisplayValue("Info")).toBeInTheDocument();
    });

    it("calls onUpdate when text changes", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();

      render(
        <CalloutSection
          section={makeSection({ variant: "warning", text: "" })}
          onUpdate={onUpdate}
          editing={true}
        />
      );

      const textarea = screen.getByPlaceholderText("Warning...");
      await user.type(textarea, "A");

      expect(onUpdate).toHaveBeenCalledWith({ variant: "warning", text: "A" });
    });

    it("calls onUpdate when variant changes", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();

      render(
        <CalloutSection
          section={makeSection({ variant: "info", text: "My text" })}
          onUpdate={onUpdate}
          editing={true}
        />
      );

      const select = screen.getByDisplayValue("Info");
      await user.selectOptions(select, "tip");

      expect(onUpdate).toHaveBeenCalledWith({ variant: "tip", text: "My text" });
    });

    it("renders all variant options in dropdown", () => {
      render(
        <CalloutSection
          section={makeSection({ variant: "info", text: "" })}
          onUpdate={vi.fn()}
          editing={true}
        />
      );

      const select = screen.getByDisplayValue("Info");
      const options = select.querySelectorAll("option");
      const values = Array.from(options).map((o) => o.value);
      expect(values).toEqual(["info", "warning", "tip", "note"]);
    });
  });

  it("defaults to info variant when variant is missing", () => {
    render(
      <CalloutSection
        section={makeSection({ text: "Fallback" })}
        onUpdate={vi.fn()}
        editing={false}
      />
    );

    expect(screen.getByText("Info")).toBeInTheDocument();
  });
});
