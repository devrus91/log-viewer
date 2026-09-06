import { describe, expect, it } from "vitest";
import { calculateWheelZoomRange } from "./wheel-zoom";

describe("mouse-wheel chart zoom", () => {
  it("expands beyond the currently rendered sample slice when scrolling down", () => {
    expect(calculateWheelZoomRange([100, 199], 1000, .5, 120)).toEqual([91, 208]);
  });

  it("keeps the cursor anchor stable while zooming in", () => {
    expect(calculateWheelZoomRange([100, 199], 1000, .25, -120)).toEqual([104, 187]);
  });

  it("clamps expansion to the complete log", () => {
    expect(calculateWheelZoomRange([0, 999], 1000, .5, 120)).toEqual([0, 999]);
    expect(calculateWheelZoomRange([900, 999], 1000, 1, 120)).toEqual([882, 999]);
  });
});
