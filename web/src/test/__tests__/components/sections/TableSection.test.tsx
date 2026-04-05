import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TableSection } from "@/components/sections/TableSection";
import type { Section } from "@/types";

function makeSection(content: Record<string, unknown> = {}): Section {
  return {
    id: "section-1",
    type: "table",
    order: 0,
    content: {
      headers: ["Name", "Value"],
      rows: [
        ["Alice", "100"],
        ["Bob", "200"],
      ],
      ...content,
    },
    meta: {},
  };
}

describe("TableSection", () => {
  describe("view mode", () => {
    it("renders headers", () => {
      render(
        <TableSection
          section={makeSection()}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Value")).toBeInTheDocument();
    });

    it("renders rows and cells", () => {
      render(
        <TableSection
          section={makeSection()}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("200")).toBeInTheDocument();
    });

    it("renders as plain text, not inputs", () => {
      render(
        <TableSection
          section={makeSection()}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      // Headers/cells should be spans, not inputs
      expect(screen.queryByDisplayValue("Alice")).not.toBeInTheDocument();
      expect(screen.getByText("Alice").tagName).toBe("SPAN");
    });

    it("does not show add row button", () => {
      render(
        <TableSection
          section={makeSection()}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      expect(screen.queryByText("+ Add row")).not.toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    it("renders header inputs", () => {
      render(
        <TableSection
          section={makeSection()}
          onUpdate={vi.fn()}
          editing={true}
        />
      );

      expect(screen.getByDisplayValue("Name")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Value")).toBeInTheDocument();
    });

    it("renders cell inputs", () => {
      render(
        <TableSection
          section={makeSection()}
          onUpdate={vi.fn()}
          editing={true}
        />
      );

      expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
      expect(screen.getByDisplayValue("100")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Bob")).toBeInTheDocument();
      expect(screen.getByDisplayValue("200")).toBeInTheDocument();
    });

    it("calls onUpdate when a cell is edited", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();

      render(
        <TableSection
          section={makeSection()}
          onUpdate={onUpdate}
          editing={true}
        />
      );

      const aliceInput = screen.getByDisplayValue("Alice");
      await user.type(aliceInput, "!");

      expect(onUpdate).toHaveBeenCalled();
      // The onChange fires with the current value + typed character
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
      expect(lastCall.rows[0][0]).toBe("Alice!");
    });

    it("calls onUpdate when header is edited", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();

      render(
        <TableSection
          section={makeSection()}
          onUpdate={onUpdate}
          editing={true}
        />
      );

      const nameHeader = screen.getByDisplayValue("Name");
      await user.type(nameHeader, "!");

      expect(onUpdate).toHaveBeenCalled();
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
      expect(lastCall.headers[0]).toBe("Name!");
    });

    it("adds a row when '+ Add row' is clicked", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();

      render(
        <TableSection
          section={makeSection()}
          onUpdate={onUpdate}
          editing={true}
        />
      );

      await user.click(screen.getByText("+ Add row"));

      expect(onUpdate).toHaveBeenCalledWith({
        headers: ["Name", "Value"],
        rows: [["Alice", "100"], ["Bob", "200"], ["", ""]],
      });
    });

    it("adds a column when add column button is clicked", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();

      render(
        <TableSection
          section={makeSection()}
          onUpdate={onUpdate}
          editing={true}
        />
      );

      await user.click(screen.getByTitle("Add column"));

      expect(onUpdate).toHaveBeenCalledWith({
        headers: ["Name", "Value", "Column 3"],
        rows: [["Alice", "100", ""], ["Bob", "200", ""]],
      });
    });

    it("removes a row when remove row button is clicked", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();

      render(
        <TableSection
          section={makeSection()}
          onUpdate={onUpdate}
          editing={true}
        />
      );

      const removeRowBtns = screen.getAllByTitle("Remove row");
      await user.click(removeRowBtns[0]);

      expect(onUpdate).toHaveBeenCalledWith({
        headers: ["Name", "Value"],
        rows: [["Bob", "200"]],
      });
    });

    it("removes a column when remove column button is clicked", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();

      render(
        <TableSection
          section={makeSection()}
          onUpdate={onUpdate}
          editing={true}
        />
      );

      const removeColBtns = screen.getAllByTitle("Remove column");
      await user.click(removeColBtns[0]);

      expect(onUpdate).toHaveBeenCalledWith({
        headers: ["Value"],
        rows: [["100"], ["200"]],
      });
    });

    it("does not show remove row button when only one row exists", () => {
      render(
        <TableSection
          section={makeSection({
            headers: ["Col"],
            rows: [["Only row"]],
          })}
          onUpdate={vi.fn()}
          editing={true}
        />
      );

      expect(screen.queryByTitle("Remove row")).not.toBeInTheDocument();
    });

    it("does not show remove column button when only one column exists", () => {
      render(
        <TableSection
          section={makeSection({
            headers: ["Only Col"],
            rows: [["a"], ["b"]],
          })}
          onUpdate={vi.fn()}
          editing={true}
        />
      );

      expect(screen.queryByTitle("Remove column")).not.toBeInTheDocument();
    });
  });
});
