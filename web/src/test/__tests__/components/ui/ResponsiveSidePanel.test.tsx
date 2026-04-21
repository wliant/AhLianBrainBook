import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResponsiveSidePanel } from "@/components/ui/ResponsiveSidePanel";

describe("ResponsiveSidePanel", () => {
  it("renders children when open", () => {
    render(
      <ResponsiveSidePanel open>
        <div data-testid="child">content</div>
      </ResponsiveSidePanel>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ResponsiveSidePanel open={false}>
        <div data-testid="child">content</div>
      </ResponsiveSidePanel>
    );
    expect(container.firstChild).toBeNull();
  });

  it("calls onDismiss when the mobile backdrop is clicked", async () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <ResponsiveSidePanel open onDismiss={onDismiss}>
        <div>content</div>
      </ResponsiveSidePanel>
    );
    const backdrop = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(backdrop).toBeTruthy();
    expect(backdrop.className).toContain("lg:hidden");

    await userEvent.click(backdrop);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not render a backdrop when onDismiss is omitted", () => {
    const { container } = render(
      <ResponsiveSidePanel open>
        <div>content</div>
      </ResponsiveSidePanel>
    );
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeNull();
  });
});
