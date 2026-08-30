import { describe, expect, it } from "vitest";
import { minMaxDownsample } from "./downsample";

describe("min/max downsampling", () => {
  it("preserves endpoints and extrema", () => {
    const x = Float64Array.from({ length: 1000 }, (_, index) => index);
    const y = Float64Array.from({ length: 1000 }, (_, index) => index === 503 ? 9999 : Math.sin(index));
    const [sampleX, sampleY] = minMaxDownsample(x, y, 100);
    expect(sampleX[0]).toBe(0);
    expect(sampleX.at(-1)).toBe(999);
    expect(Math.max(...sampleY)).toBe(9999);
  });
});
