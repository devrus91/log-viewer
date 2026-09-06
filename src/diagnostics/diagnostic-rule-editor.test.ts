import { describe, expect, it } from "vitest";
import { createCustomDiagnosticRule, validateDiagnosticRule } from "./diagnostic-rule-editor";

describe("custom diagnostic rule editor", () => {
  it("creates an editable WOT-only condition rule", () => {
    const rule = createCustomDiagnosticRule("custom-1");

    expect(rule).toMatchObject({ id: "custom-1", origin: "user", detector: "temporal", wotOnly: true });
    expect(rule.conditions).toHaveLength(1);
    expect(validateDiagnosticRule(rule)).toBeNull();
  });

  it("requires a name and at least one condition", () => {
    const rule = createCustomDiagnosticRule("custom-2");

    expect(validateDiagnosticRule({ ...rule, name: " " })).toBe("Rule name is required.");
    expect(validateDiagnosticRule({ ...rule, conditions: [] })).toBe("Add at least one condition.");
  });

  it("reports parameters referenced by conditions but not defined", () => {
    const rule = createCustomDiagnosticRule("custom-3");

    expect(validateDiagnosticRule({ ...rule, parameters: {} })).toBe("Unknown rule parameter: MIN_RPM");
  });

  it("validates window function arguments before saving", () => {
    const rule = createCustomDiagnosticRule("custom-4");

    expect(validateDiagnosticRule({ ...rule, conditions: [{ left: "moving_avg([engine.rpm], 0)", operator: ">", right: "MIN_RPM" }] })).toContain("positive integer");
    expect(validateDiagnosticRule({ ...rule, conditions: [{ left: "moving_avg([engine.rpm])", operator: ">", right: "MIN_RPM" }] })).toContain("expects an expression");
  });
});
