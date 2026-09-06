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

  it("evaluates lag, delta, and rolling aggregate functions", () => {
    const channels = { A: new Float64Array([1, 2, 3, 4, 5]) };

    expect(Array.from(evaluateFormula("lag([A], 2)", channels))).toEqual([Number.NaN, Number.NaN, 1, 2, 3]);
    expect(Array.from(evaluateFormula("delta([A], 2)", channels))).toEqual([Number.NaN, Number.NaN, 2, 2, 2]);
    expect(Array.from(evaluateFormula("moving_avg([A], 3)", channels))).toEqual([Number.NaN, Number.NaN, 2, 3, 4]);
    expect(Array.from(evaluateFormula("moving_min([A], 3)", channels))).toEqual([Number.NaN, Number.NaN, 1, 2, 3]);
    expect(Array.from(evaluateFormula("moving_max([A], 3)", channels))).toEqual([Number.NaN, Number.NaN, 3, 4, 5]);
    expect(Array.from(evaluateFormula("moving_sum([A], 3)", channels))).toEqual([Number.NaN, Number.NaN, 6, 9, 12]);
  });

  it("validates window size and supports parameterized windows", () => {
    expect(Array.from(evaluateFormula("moving_avg([A], WINDOW)", { A: new Float64Array([2, 4, 6]) }, { WINDOW: 2 }))).toEqual([Number.NaN, 3, 5]);
    expect(() => evaluateFormula("lag([A], 0)", { A: new Float64Array([1]) })).toThrow("positive integer");
    expect(() => evaluateFormula("lag([A])", { A: new Float64Array([1]) })).toThrow("expects an expression and a window size");
  });
});
