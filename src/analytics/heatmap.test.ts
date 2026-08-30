import { describe, expect, it } from "vitest";
import { buildHeatmap } from "./heatmap";

describe("heatmap binning", () => {
  it("aggregates original samples and applies filters", () => {
    const result = buildHeatmap({
      x: new Float64Array([0, 0.1, 1, 1.1]), y: new Float64Array([0, 0.1, 1, 1.1]), value: new Float64Array([2, 4, 6, 8]),
      xBins: 2, yBins: 2, aggregation: "average", minSamples: 2,
      filters: [{ config: { id: "f", channelId: "gear", operator: "=", value: 4 }, values: new Float64Array([4, 4, 3, 4]) }],
    });
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]).toMatchObject({ value: 3, count: 2 });
  });
});
