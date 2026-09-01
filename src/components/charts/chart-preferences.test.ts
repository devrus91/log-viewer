import { describe, expect, it } from "vitest";
import { diagnosticMarkerVisible, filterTooltipRows, formatChartValue, interpolateValue } from "./chart-preferences";

describe("chart preferences", () => {
  it("formats values using automatic or fixed precision", () => {
    expect(formatChartValue(12.345, "auto")).toBe("12.35");
    expect(formatChartValue(12.345, "1")).toBe("12.3");
    expect(formatChartValue(Number.NaN, "2")).toBe("—");
  });

  it("filters diagnostic markers by severity", () => {
    expect(diagnosticMarkerVisible("info", "warning-critical")).toBe(false);
    expect(diagnosticMarkerVisible("warning", "warning-critical")).toBe(true);
    expect(diagnosticMarkerVisible("critical", "critical")).toBe(true);
  });

  it("interpolates finite values and rejects gaps", () => {
    expect(interpolateValue(10, 20, .25)).toBe(12.5);
    expect(interpolateValue(10, undefined, .5)).toBeNull();
  });

  it("filters tooltip rows while retaining pinned channels", () => {
    const rows = [{ id: "focused", active: true, pinned: false }, { id: "pinned", active: false, pinned: true }, { id: "other", active: false, pinned: false }];
    expect(filterTooltipRows(rows, "focused-pinned", true).map((row) => row.id)).toEqual(["focused", "pinned"]);
    expect(filterTooltipRows(rows, "focused", true).map((row) => row.id)).toEqual(["focused"]);
    expect(filterTooltipRows(rows, "focused", false)).toEqual(rows);
  });
});
