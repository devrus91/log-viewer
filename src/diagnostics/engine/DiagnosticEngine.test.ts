import { describe, expect, it } from "vitest";
import { parseCsv } from "@/data/csv";
import { analyzeDataset } from "./DiagnosticEngine";
import { createDefaultDiagnosticRules } from "@/diagnostics/defaults/defaultRules";
import { createCustomDiagnosticRule } from "@/diagnostics/diagnostic-rule-editor";
import type { DiagnosticProfile } from "@/domain/types";

function fixture() {
  const header = ["Time (s)", "Engine Speed (rpm)", "Accelerator Pedal Position (%)", "Throttle Actual (%)", "Boost Pressure Actual (bar)", "Boost Pressure Target (bar)", "Torque Request (Nm)", "Torque Actual (Nm)", "Ignition Timing Cylinder 1", "Ignition Timing Cylinder 2", "Ignition Timing Cylinder 3", "Knock Retard Cylinder 1", "Knock Retard Cylinder 2", "Knock Retard Cylinder 3", "High Pressure Fuel Pressure Actual (bar)", "High Pressure Fuel Pressure Target (bar)", "Lambda Actual", "Lambda Target", "Injector Duty (%)", "Short Term Fuel Trim (%)", "Long Term Fuel Trim (%)", "Intake Air Temperature (°C)", "Engine Coolant Temperature (°C)", "Intake Cam Actual", "Intake Cam Target", "Converter Lockup Clutch Slip", "Gear", "Vehicle Speed (km/h)", "Wheel Speed FL (km/h)", "Wheel Speed FR (km/h)", "Wheel Speed RL (km/h)", "Wheel Speed RR (km/h)"].join(",");
  const rows = Array.from({ length: 120 }, (_, index) => {
    const throttle = index >= 40 && index <= 43 ? 40 : 95;
    let boost = 2;
    if (index >= 10 && index <= 17) boost = 1.3;
    if (index >= 22 && index <= 27) boost = 2.7;
    if (index === 30) boost = 2.2;
    if (index >= 31 && index <= 34) boost = 1.2;
    if (index === 70 || index === 71) boost = 0;
    const fuel = index === 0 ? 200 : index === 1 ? 160 : 120;
    const knock = [10, 11, 30, 31, 50, 51, 70, 71].includes(index) ? -4 : 0;
    const wheelFl = index < 5 ? 70 : 100;
    return [index * .05, 3000 + index * 40, 99, throttle, boost, 2, 600, 300, -4, 2, 2, 0, 0, knock, fuel, 200, .95, .8, 96, 20, 0, 70, 115, 100, 120, 300, index < 60 ? 3 : 4, 70, wheelFl, 70, 70, 70].join(",");
  });
  return parseCsv([header, ...rows].join("\n"), "diagnostic-fixture.csv");
}

describe("built-in diagnostic rules", () => {
  const defaults = createDefaultDiagnosticRules();

  it("provides the complete versioned MVP rule set", () => {
    expect(defaults).toHaveLength(26);
    expect(new Set(defaults.map((rule) => rule.id)).size).toBe(26);
    defaults.forEach((rule) => {
      expect(rule.origin).toBe("default");
      expect(rule.wotOnly).toBe(rule.detector !== "pull");
      expect(rule.message.length).toBeGreaterThan(5);
      expect(rule.recommendedChannels.length).toBeGreaterThan(0);
    });
  });

  it.each(defaults.map((rule) => [rule.id, rule] as const))("executes %s from configuration and detects its fixture pattern", (_id, rule) => {
    const dataset = fixture();
    const profile: DiagnosticProfile = { id: "test", name: "Test", origin: "user", vehicleSpecific: true, rules: [structuredClone(rule)] };
    const analysis = analyzeDataset({ channels: dataset.channels, columns: dataset.columns, profile });
    expect(analysis.events.some((event) => event.ruleId === rule.id)).toBe(true);
  });

  it("returns health counts, semantic mapping, pulls and correlations", () => {
    const dataset = fixture();
    const profile: DiagnosticProfile = { id: "test", name: "Test", origin: "user", vehicleSpecific: true, rules: defaults };
    const analysis = analyzeDataset({ channels: dataset.channels, columns: dataset.columns, profile });
    expect(analysis.events.length).toBeGreaterThan(20);
    expect(analysis.pulls.length).toBeGreaterThan(0);
    expect(analysis.semanticMapping.some((match) => match.canonical === "boost.actual")).toBe(true);
    expect(analysis.counts.critical + analysis.counts.warning + analysis.counts.info).toBe(analysis.events.length);
    expect(analysis.events.some((event) => event.correlatedEventIds.length > 0)).toBe(true);
    expect(new Set(analysis.events.map((event) => event.id)).size).toBe(analysis.events.length);
    analysis.events.filter((event) => event.ruleId !== "wot-pull-detection").forEach((event) => {
      expect(analysis.pulls.some((pull) => event.startIndex >= pull.startIndex && event.endIndex <= pull.endIndex)).toBe(true);
    });
  });

  it("executes window functions in a custom condition rule", () => {
    const dataset = fixture();
    const rule = { ...createCustomDiagnosticRule("custom-window"), conditions: [{ left: "moving_avg([boost.actual], WINDOW)", operator: "<" as const, right: "LIMIT" }], parameters: { WINDOW: 3, LIMIT: 1.5 }, durationMs: 0, cooldownMs: 0 };
    const profile: DiagnosticProfile = { id: "test", name: "Test", origin: "user", vehicleSpecific: true, rules: [rule] };

    const analysis = analyzeDataset({ channels: dataset.channels, columns: dataset.columns, profile });

    expect(analysis.events.some((event) => event.ruleId === rule.id)).toBe(true);
  });
});
