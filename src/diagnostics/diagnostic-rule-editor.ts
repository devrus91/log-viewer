import { collectParameters, FORMULA_WINDOW_FUNCTIONS, parseFormula, type FormulaNode } from "@/domain/formula";
import type { DiagnosticCategory, DiagnosticRuleConfig } from "@/domain/types";

export const DIAGNOSTIC_CATEGORIES: DiagnosticCategory[] = ["Boost", "Fuel", "Ignition", "Knock", "Torque", "Transmission", "Temperature", "Sensors", "Wheel Speed", "Engine"];

export function createCustomDiagnosticRule(id: string): DiagnosticRuleConfig {
  return {
    id,
    name: "New custom rule",
    category: "Engine",
    enabled: true,
    wotOnly: true,
    severity: "warning",
    origin: "user",
    modified: true,
    detector: "temporal",
    conditions: [{ left: "[engine.rpm]", operator: ">", right: "MIN_RPM" }],
    parameters: { MIN_RPM: 2500 },
    durationMs: 100,
    cooldownMs: 500,
    correlationWindowMs: 500,
    recommendedChannels: ["engine.rpm", "throttle.actual"],
    message: "Custom diagnostic condition detected.",
    possibleCauses: [],
    detectorOptions: { conditionMode: "all" },
  };
}

function validateWindowCalls(node: FormulaNode, parameters: Record<string, number>): string | null {
  if (node.type === "CallExpression") {
    if ((FORMULA_WINDOW_FUNCTIONS as readonly string[]).includes(node.name)) {
      if (node.arguments.length !== 2) return `${node.name} expects an expression and a window size.`;
      const sizeNode = node.arguments[1];
      const size = sizeNode.type === "Literal" ? sizeNode.value : sizeNode.type === "ParameterReference" ? parameters[sizeNode.name] : Number.NaN;
      if (sizeNode.type !== "ParameterReference" || size !== undefined) {
        if (!Number.isInteger(size) || size < 1) return `Window size in ${node.name} must be a positive integer or parameter.`;
        if (size > 10_000) return `Window size in ${node.name} cannot exceed 10000.`;
      }
    }
    for (const argument of node.arguments) { const error = validateWindowCalls(argument, parameters); if (error) return error; }
  } else if (node.type === "UnaryExpression") return validateWindowCalls(node.argument, parameters);
  else if (node.type === "BinaryExpression") return validateWindowCalls(node.left, parameters) ?? validateWindowCalls(node.right, parameters);
  return null;
}

export function validateDiagnosticRule(rule: DiagnosticRuleConfig): string | null {
  if (!rule.name.trim()) return "Rule name is required.";
  if (rule.detector === "temporal" && rule.conditions.length === 0) return "Add at least one condition.";
  if (rule.durationMs < 0 || rule.cooldownMs < 0 || rule.correlationWindowMs < 0) return "Time values cannot be negative.";

  const invalidParameter = Object.entries(rule.parameters).find(([name, value]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || !Number.isFinite(value));
  if (invalidParameter) return `Invalid rule parameter: ${invalidParameter[0]}`;

  try {
    const expressions = [...rule.conditions.flatMap((condition) => [condition.left, condition.right]), ...(rule.criticalCondition ? [rule.criticalCondition.left, rule.criticalCondition.right] : [])];
    const nodes = expressions.map(parseFormula);
    const parameters = new Set(nodes.flatMap((node) => Array.from(collectParameters(node))));
    const missing = Array.from(parameters).filter((name) => rule.parameters[name] === undefined);
    if (missing.length) return `Unknown rule parameter${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`;
    for (const node of nodes) { const windowError = validateWindowCalls(node, rule.parameters); if (windowError) return windowError; }
  } catch (reason) {
    return reason instanceof Error ? reason.message : "Invalid rule expression";
  }

  return null;
}
