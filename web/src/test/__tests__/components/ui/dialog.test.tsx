import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

describe("DialogContent", () => {
  it("applies viewport-safe default width and height classes", () => {
    render(
      <Dialog open>
        <DialogContent data-testid="content">Hello</DialogContent>
      </Dialog>
    );
    const content = screen.getByTestId("content");
    expect(content.className).toContain("w-[calc(100vw-2rem)]");
    expect(content.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(content.className).toContain("overflow-y-auto");
    expect(content.className).toContain("max-w-lg");
  });

  it("accepts class overrides", () => {
    render(
      <Dialog open>
        <DialogContent data-testid="content" className="sm:max-w-4xl">
          Hello
        </DialogContent>
      </Dialog>
    );
    const content = screen.getByTestId("content");
    expect(content.className).toContain("sm:max-w-4xl");
  });
});
