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

  it("never returns an invalid CSS coordinate for transient cursor values", () => {
    for (const cursorLeft of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
      const left = resolveTooltipLeft({ cursorLeft, tooltipWidth: 240, containerWidth: 900, preference: "auto" });
      expect(Number.isFinite(left)).toBe(true);
      expect(left).toBeGreaterThanOrEqual(8);
      expect(left).toBeLessThanOrEqual(652);
    }
  });

  it("sanitizes invalid dimensions and spacing", () => {
    expect(Number.isFinite(resolveTooltipLeft({ cursorLeft: 100, tooltipWidth: Number.POSITIVE_INFINITY, containerWidth: Number.NaN, preference: "right", gap: Number.NaN, edgePadding: Number.NaN }))).toBe(true);
  });
});
