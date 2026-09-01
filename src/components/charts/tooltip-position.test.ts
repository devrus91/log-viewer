import { describe, expect, it } from "vitest";
import { resolveTooltipLeft } from "./tooltip-position";

describe("resolveTooltipLeft", () => {
  it("places automatic tooltips close to the cursor on the left when they fit", () => {
    expect(resolveTooltipLeft({ cursorLeft: 500, tooltipWidth: 240, containerWidth: 900, preference: "auto" })).toBe(252);
  });

  it("moves automatic tooltips to the right near the left edge", () => {
    expect(resolveTooltipLeft({ cursorLeft: 120, tooltipWidth: 240, containerWidth: 900, preference: "auto" })).toBe(128);
  });

  it("honors a right preference when the right side fits", () => {
    expect(resolveTooltipLeft({ cursorLeft: 400, tooltipWidth: 240, containerWidth: 900, preference: "right" })).toBe(408);
  });

  it("falls back to the opposite side to keep the tooltip visible", () => {
    expect(resolveTooltipLeft({ cursorLeft: 820, tooltipWidth: 240, containerWidth: 900, preference: "right" })).toBe(572);
  });
});
