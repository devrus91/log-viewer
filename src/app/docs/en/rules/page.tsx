import type { Metadata } from "next";
import { DiagnosticRulesReferencePage } from "@/components/docs/DiagnosticRulesReferencePage";
import type { DocumentedRuleGroup } from "@/components/docs/DiagnosticRuleCatalog";

export const metadata: Metadata = {
  title: "Built-in diagnostic rules — WOT Lab",
  description: "A reference for the 26 built-in diagnostic rules and their default thresholds.",
};

const BUILT_IN_RULES: DocumentedRuleGroup[] = [
  { category: "Boost", rules: [
    { name: "Boost Under Target", severity: "warning", severityLabel: "Warning", description: "Actual boost stays more than 0.3 below target with throttle above 80% and RPM above 2500 for at least 250 ms. An error above 0.55 is critical." },
    { name: "Boost Over Target", severity: "warning", severityLabel: "Warning", description: "Actual boost stays more than 0.25 above target with throttle above 80% and RPM above 2500 for at least 120 ms. An overshoot above 0.5 is critical." },
    { name: "Unexpected Boost Drop", severity: "warning", severityLabel: "Warning", description: "Boost falls by more than 0.45 within 250 ms with throttle above 85% and RPM above 2500. Minimum duration is 40 ms." },
  ] },
  { category: "Torque", rules: [
    { name: "Unexpected Throttle Closure", severity: "warning", severityLabel: "Warning", description: "Pedal demand is above 90% while throttle is below 70% for longer than 50 ms. Throttle below 40% is critical." },
    { name: "Torque Intervention", severity: "warning", severityLabel: "Warning", description: "Actual torque stays more than 120 Nm below requested torque with throttle above 70% for at least 100 ms." },
  ] },
  { category: "Ignition", rules: [
    { name: "Ignition Retard", severity: "warning", severityLabel: "Warning", description: "A cylinder timing value, or total timing when cylinder channels are absent, stays below −3° for at least 50 ms. Below −6° is critical." },
    { name: "Cylinder Ignition Deviation", severity: "warning", severityLabel: "Warning", description: "One cylinder differs from the middle of its peers by more than 5° for at least 50 ms. Above 8° is critical; at least three cylinder channels are required." },
  ] },
  { category: "Knock", rules: [
    { name: "Knock Retard", severity: "warning", severityLabel: "Warning", description: "Knock correction on any cylinder stays below −3° for at least 40 ms. Below −6° is critical." },
    { name: "Repeated Cylinder Knock", severity: "warning", severityLabel: "Warning", description: "The same cylinder has at least three correction episodes below −2.5° within 5 seconds. A value below −6° makes the event critical." },
  ] },
  { category: "Fuel system", rules: [
    { name: "Fuel Pressure Below Target", severity: "critical", severityLabel: "Critical", description: "Fuel pressure stays below 90% of target with throttle above 80% and RPM above 3000 for at least 200 ms. The rule immediately creates a critical event." },
    { name: "Fuel Pressure Sudden Drop", severity: "critical", severityLabel: "Critical", description: "Fuel pressure falls faster than −500 units/s with throttle above 80% and RPM above 2500 for at least 30 ms." },
    { name: "Lambda Lean vs Target", severity: "critical", severityLabel: "Critical", description: "Actual lambda stays more than 0.08 above target with throttle above 80% and RPM above 2500 for at least 120 ms." },
    { name: "Injector Duty Saturation", severity: "warning", severityLabel: "Warning", description: "Injector duty stays above 95% for at least 200 ms. A value above 99.5% is critical." },
    { name: "Excessive Fuel Trims", severity: "warning", severityLabel: "Warning", description: "Short-term trim exceeds ±15% or long-term trim exceeds ±12% for at least 500 ms." },
  ] },
  { category: "Temperature", rules: [
    { name: "High Intake Air Temperature", severity: "warning", severityLabel: "Warning", description: "Intake air temperature stays above 60 °C for at least one second. Above 80 °C is critical." },
    { name: "Engine Overheating", severity: "warning", severityLabel: "Warning", description: "Coolant temperature stays above 110 °C for at least 500 ms. Above 120 °C is critical." },
  ] },
  { category: "Engine", rules: [
    { name: "Cam Target Deviation", severity: "warning", severityLabel: "Warning", description: "The intake or exhaust cam differs from its target by more than 10° for at least 200 ms." },
    { name: "Rev Limiter Intervention", severity: "info", severityLabel: "Info", description: "RPM is above 6800 with pedal demand above 80% for at least 50 ms. This may represent normal limiter operation." },
    { name: "WOT Pull", severity: "info", severityLabel: "Info", description: "Detects a full-throttle area: throttle at or above 90%, duration of at least one second, and an RPM increase of at least 500." },
  ] },
  { category: "Transmission", rules: [
    { name: "TCC / Transmission Slip", severity: "warning", severityLabel: "Warning", description: "Absolute slip is above 250 rpm in third gear or higher with throttle above 30% for at least 300 ms." },
    { name: "Gear Shift", severity: "info", severityLabel: "Info", description: "Records a change in the reported gear number inside a WOT area." },
  ] },
  { category: "Wheel speed", rules: [
    { name: "Wheel Speed Mismatch", severity: "warning", severityLabel: "Warning", description: "Wheel-speed spread is above 8 km/h with vehicle speed at or above 20 km/h for at least 100 ms. Above 20 km/h is critical." },
    { name: "Wheel Speed Spike", severity: "warning", severityLabel: "Warning", description: "One wheel differs from the others by more than 15 km/h for at least 20 ms. Above 30 km/h is critical." },
  ] },
  { category: "Sensors and data", rules: [
    { name: "Sensor / Data Dropout", severity: "warning", severityLabel: "Warning", description: "Finds a gap, invalid value, or zero reset lasting at least two samples between valid values." },
    { name: "Sensor Impossible Rate of Change", severity: "warning", severityLabel: "Warning", description: "Finds an implausibly fast change: wheel speed above 1800 units/s, boost above 15 units/s, or temperature above 80 units/s." },
    { name: "Stuck Sensor", severity: "info", severityLabel: "Info", description: "A signal barely changes for more than 2 seconds while RPM changes by at least 500 during that period." },
  ] },
];

export default function BuiltInRulesPage() {
  return <DiagnosticRulesReferencePage groups={BUILT_IN_RULES} copy={{
    locale: "en",
    topLabel: "RULE REFERENCE",
    languageLabel: "Documentation language",
    backToApp: "Back to the app",
    backToDocs: "Back to main documentation",
    title: "Current diagnostic rules",
    introduction: "The standard profile contains 26 enabled rules. The conditions and initial thresholds shipped with WOT Lab are described below.",
    countLabel: "built-in rules",
    scopeTitle: "Evaluation scope",
    scopeText: "Every rule except WOT Pull currently applies only inside detected full-throttle areas. The values below are defaults and can be changed in the rule editor.",
    caveatsTitle: "Current configuration details",
    caveats: [
      { title: "Fuel Pressure Below Target", text: "The rule is already critical below 90% of target, so its additional 80% threshold does not change the displayed severity." },
      { title: "Lambda Lean vs Target", text: "The rule is already critical at an error of 0.08. Its additional 0.15 threshold currently cannot raise the severity further." },
      { title: "Cam / Transmission", text: "The 18° critical cam deviation and 500 rpm critical slip parameters exist but do not currently raise event severity." },
      { title: "Gear Shift", text: "Any change in the rounded gear number inside a WOT area is currently recorded; the configured 300 ms settling time is not applied." },
      { title: "Units", text: "Thresholds assume the expected channel units. Channel matching does not convert bar to kPa, angles, or speed units." },
      { title: "Merging", text: "Neighboring triggers separated by up to 500 ms are normally merged, and nearby events from different rules are associated." },
    ],
  }} />;
}
