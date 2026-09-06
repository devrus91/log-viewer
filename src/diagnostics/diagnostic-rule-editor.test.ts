import { describe, expect, it } from "vitest";
import { createCustomDiagnosticRule, renameDiagnosticRuleParameter, validateDiagnosticRule } from "./diagnostic-rule-editor";

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

  it("renames a parameter and every rule reference to it", () => {
    const rule = { ...createCustomDiagnosticRule("custom-5"), criticalCondition: { left: "[engine.rpm]", operator: ">" as const, right: "MIN_RPM + 500" }, detectorOptions: { thresholdParameter: "MIN_RPM" } };
    const renamed = renameDiagnosticRuleParameter(rule, "MIN_RPM", "WOT_RPM");

    expect(renamed.parameters).toEqual({ WOT_RPM: 2500 });
    expect(renamed.conditions[0].right).toBe("WOT_RPM");
    expect(renamed.criticalCondition?.right).toBe("WOT_RPM + 500");
    expect(renamed.detectorOptions.thresholdParameter).toBe("WOT_RPM");
    expect(validateDiagnosticRule(renamed)).toBeNull();
  });
});
