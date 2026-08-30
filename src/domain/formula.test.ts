import { describe, expect, it } from "vitest";
import { collectDependencies, evaluateFormula, hasCycle, parseFormula } from "./formula";

describe("safe formula engine", () => {
  it("parses channel references and precedence", () => {
    const ast = parseFormula("([Wheel Speed] - OFFSET) / max(SCALE, 1)");
    expect(Array.from(collectDependencies(ast))).toEqual(["Wheel Speed"]);
    const values = evaluateFormula("([Wheel Speed] - OFFSET) / max(SCALE, 1)", { "Wheel Speed": new Float64Array([3276.7, 3332.2]) }, { OFFSET: 3276.7, SCALE: 5.55 });
    expect(values[0]).toBeCloseTo(0);
    expect(values[1]).toBeCloseTo(10);
  });

  it("returns NaN for division by zero and rejects unknown functions", () => {
    expect(Number.isNaN(evaluateFormula("[A] / 0", { A: new Float64Array([2]) })[0])).toBe(true);
    expect(() => parseFormula("eval(1)")).toThrow("Unknown function");
  });

  it("detects dependency cycles", () => {
    expect(hasCycle({ A: ["B"], B: ["C"], C: ["A"] })).toBe(true);
    expect(hasCycle({ A: ["raw"], B: ["A"] })).toBe(false);
  });
});
