import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DividerSection } from "@/components/sections/DividerSection";

describe("DividerSection", () => {
  it("renders an hr element", () => {
    const { container } = render(<DividerSection />);

    const hr = container.querySelector("hr");
    expect(hr).toBeInTheDocument();
  });

  it("has border-border class for styling", () => {
    const { container } = render(<DividerSection />);

    const hr = container.querySelector("hr");
    expect(hr?.className).toContain("border-border");
  });

  it("does not render any interactive controls", () => {
    const { container } = render(<DividerSection />);

    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelectorAll("textarea")).toHaveLength(0);
    expect(container.querySelectorAll("select")).toHaveLength(0);
  });

  it("accepts no props", () => {
    // DividerSection takes no props, just renders an hr
    const { container } = render(<DividerSection />);
    expect(container.firstChild).toBeTruthy();
  });
});
