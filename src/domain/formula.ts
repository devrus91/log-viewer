export type FormulaNode =
  | { type: "Literal"; value: number }
  | { type: "ChannelReference"; name: string }
  | { type: "ParameterReference"; name: string }
  | { type: "UnaryExpression"; operator: "+" | "-" | "NOT"; argument: FormulaNode }
  | { type: "BinaryExpression"; operator: string; left: FormulaNode; right: FormulaNode }
  | { type: "CallExpression"; name: string; arguments: FormulaNode[] };

type Token = { type: "number" | "identifier" | "channel" | "operator" | "paren" | "comma"; value: string };

const SCALAR_FUNCTIONS: Record<string, (...values: number[]) => number> = {
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  avg: (...values) => values.reduce((sum, value) => sum + value, 0) / values.length,
  sqrt: Math.sqrt,
  pow: Math.pow,
  clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  if: (condition, yes, no) => condition ? yes : no,
};

export const FORMULA_WINDOW_FUNCTIONS = ["lag", "delta", "moving_avg", "moving_min", "moving_max", "moving_sum"] as const;
const WINDOW_FUNCTIONS = new Set<string>(FORMULA_WINDOW_FUNCTIONS);
const MAX_WINDOW_SIZE = 10_000;

export interface FormulaEvaluationContext {
  rowCount: number;
  windowCache: WeakMap<FormulaNode, Float64Array>;
}

export function createFormulaEvaluationContext(rowCount: number): FormulaEvaluationContext {
  return { rowCount: Math.max(0, rowCount), windowCache: new WeakMap() };
}

export function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const rest = expression.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) { index += whitespace[0].length; continue; }
    if (expression[index] === "[") {
      const end = expression.indexOf("]", index + 1);
      if (end < 0) throw new Error("Unclosed channel reference");
      tokens.push({ type: "channel", value: expression.slice(index + 1, end).trim() });
      index = end + 1;
      continue;
    }
    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) { tokens.push({ type: "number", value: number[0] }); index += number[0].length; continue; }
    const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) {
      const upper = identifier[0].toUpperCase();
      tokens.push({ type: upper === "AND" || upper === "OR" || upper === "NOT" ? "operator" : "identifier", value: upper === "AND" || upper === "OR" || upper === "NOT" ? upper : identifier[0] });
      index += identifier[0].length;
      continue;
    }
    const operator = rest.match(/^(>=|<=|==|!=|[+\-*/%^><])/);
    if (operator) { tokens.push({ type: "operator", value: operator[0] }); index += operator[0].length; continue; }
    if (expression[index] === "(" || expression[index] === ")") { tokens.push({ type: "paren", value: expression[index] }); index += 1; continue; }
    if (expression[index] === ",") { tokens.push({ type: "comma", value: "," }); index += 1; continue; }
    throw new Error(`Unexpected character "${expression[index]}"`);
  }
  return tokens;
}

const PRECEDENCE: Record<string, number> = { OR: 1, AND: 2, "==": 3, "!=": 3, ">": 4, ">=": 4, "<": 4, "<=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6, "^": 7 };

export function parseFormula(expression: string): FormulaNode {
  const tokens = tokenize(expression);
  let position = 0;
  const parsePrimary = (): FormulaNode => {
    const token = tokens[position++];
    if (!token) throw new Error("Unexpected end of formula");
    if (token.type === "number") return { type: "Literal", value: Number(token.value) };
    if (token.type === "channel") return { type: "ChannelReference", name: token.value };
    if (token.type === "operator" && ["+", "-", "NOT"].includes(token.value)) return { type: "UnaryExpression", operator: token.value as "+" | "-" | "NOT", argument: parsePrimary() };
    if (token.type === "identifier") {
      if (tokens[position]?.value === "(") {
        position += 1;
        const args: FormulaNode[] = [];
        if (tokens[position]?.value !== ")") {
          do {
            args.push(parseBinary(0));
            if (tokens[position]?.value !== ",") break;
            position += 1;
          } while (position < tokens.length);
        }
        if (tokens[position]?.value !== ")") throw new Error(`Missing ) after ${token.value}`);
        position += 1;
        if (!SCALAR_FUNCTIONS[token.value.toLowerCase()] && !WINDOW_FUNCTIONS.has(token.value.toLowerCase())) throw new Error(`Unknown function "${token.value}"`);
        return { type: "CallExpression", name: token.value.toLowerCase(), arguments: args };
      }
      return { type: "ParameterReference", name: token.value };
    }
    if (token.value === "(") {
      const node = parseBinary(0);
      if (tokens[position]?.value !== ")") throw new Error("Missing closing parenthesis");
      position += 1;
      return node;
    }
    throw new Error(`Unexpected token "${token.value}"`);
  };
  const parseBinary = (minimum: number): FormulaNode => {
    let left = parsePrimary();
    while (position < tokens.length) {
      const token = tokens[position];
      const precedence = token.type === "operator" ? PRECEDENCE[token.value] : undefined;
      if (precedence === undefined || precedence < minimum) break;
      position += 1;
      const right = parseBinary(precedence + (token.value === "^" ? 0 : 1));
      left = { type: "BinaryExpression", operator: token.value, left, right };
    }
    return left;
  };
  const ast = parseBinary(0);
  if (position !== tokens.length) throw new Error(`Unexpected token "${tokens[position].value}"`);
  return ast;
}

export function collectDependencies(node: FormulaNode, result = new Set<string>()): Set<string> {
  if (node.type === "ChannelReference") result.add(node.name);
  else if (node.type === "UnaryExpression") collectDependencies(node.argument, result);
  else if (node.type === "BinaryExpression") { collectDependencies(node.left, result); collectDependencies(node.right, result); }
  else if (node.type === "CallExpression") node.arguments.forEach((argument) => collectDependencies(argument, result));
  return result;
}

export function collectParameters(node: FormulaNode, result = new Set<string>()): Set<string> {
  if (node.type === "ParameterReference") result.add(node.name);
  else if (node.type === "UnaryExpression") collectParameters(node.argument, result);
  else if (node.type === "BinaryExpression") { collectParameters(node.left, result); collectParameters(node.right, result); }
  else if (node.type === "CallExpression") node.arguments.forEach((argument) => collectParameters(argument, result));
  return result;
}

function windowSize(node: FormulaNode, channels: Record<string, Float64Array>, parameters: Record<string, number>, context: FormulaEvaluationContext): number {
  const value = evaluateNode(node, 0, channels, parameters, context);
  if (!Number.isFinite(value) || value < 1 || !Number.isInteger(value)) throw new Error("Window size must be a positive integer");
  if (value > MAX_WINDOW_SIZE) throw new Error(`Window size cannot exceed ${MAX_WINDOW_SIZE}`);
  return value;
}

function evaluateWindow(node: Extract<FormulaNode, { type: "CallExpression" }>, channels: Record<string, Float64Array>, parameters: Record<string, number>, context: FormulaEvaluationContext): Float64Array {
  const cached = context.windowCache.get(node);
  if (cached) return cached;
  if (node.arguments.length !== 2) throw new Error(`${node.name} expects an expression and a window size`);

  const size = windowSize(node.arguments[1], channels, parameters, context);
  const source = new Float64Array(context.rowCount);
  const result = new Float64Array(context.rowCount);
  result.fill(Number.NaN);
  for (let index = 0; index < context.rowCount; index += 1) source[index] = evaluateNode(node.arguments[0], index, channels, parameters, context);

  if (node.name === "lag" || node.name === "delta") {
    for (let index = size; index < context.rowCount; index += 1) result[index] = node.name === "lag" ? source[index - size] : source[index] - source[index - size];
  } else if (node.name === "moving_avg" || node.name === "moving_sum") {
    let sum = 0; let invalid = 0;
    for (let index = 0; index < context.rowCount; index += 1) {
      if (Number.isFinite(source[index])) sum += source[index]; else invalid += 1;
      if (index >= size) { if (Number.isFinite(source[index - size])) sum -= source[index - size]; else invalid -= 1; }
      if (index >= size - 1 && invalid === 0) result[index] = node.name === "moving_avg" ? sum / size : sum;
    }
  } else {
    const wantMinimum = node.name === "moving_min";
    const deque: number[] = []; let head = 0; let invalid = 0;
    for (let index = 0; index < context.rowCount; index += 1) {
      if (!Number.isFinite(source[index])) invalid += 1;
      if (index >= size && !Number.isFinite(source[index - size])) invalid -= 1;
      while (head < deque.length && deque[head] <= index - size) head += 1;
      if (Number.isFinite(source[index])) {
        while (deque.length > head && (wantMinimum ? source[deque.at(-1)!] >= source[index] : source[deque.at(-1)!] <= source[index])) deque.pop();
        deque.push(index);
      }
      if (index >= size - 1 && invalid === 0 && head < deque.length) result[index] = source[deque[head]];
    }
  }

  context.windowCache.set(node, result);
  return result;
}

export function evaluateNode(node: FormulaNode, row: number, channels: Record<string, Float64Array>, parameters: Record<string, number>, context?: FormulaEvaluationContext): number {
  switch (node.type) {
    case "Literal": return node.value;
    case "ChannelReference": {
      const values = channels[node.name];
      if (!values) throw new Error(`Unknown channel "${node.name}"`);
      return values[row];
    }
    case "ParameterReference": {
      const value = parameters[node.name];
      if (value === undefined) throw new Error(`Unknown parameter "${node.name}"`);
      return value;
    }
    case "UnaryExpression": {
      const value = evaluateNode(node.argument, row, channels, parameters, context);
      if (node.operator === "-") return -value;
      if (node.operator === "NOT") return value ? 0 : 1;
      return value;
    }
    case "BinaryExpression": {
      const left = evaluateNode(node.left, row, channels, parameters, context);
      const right = evaluateNode(node.right, row, channels, parameters, context);
      switch (node.operator) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": return right === 0 ? Number.NaN : left / right;
        case "%": return right === 0 ? Number.NaN : left % right;
        case "^": return left ** right;
        case ">": return Number(left > right);
        case ">=": return Number(left >= right);
        case "<": return Number(left < right);
        case "<=": return Number(left <= right);
        case "==": return Number(left === right);
        case "!=": return Number(left !== right);
        case "AND": return Number(Boolean(left) && Boolean(right));
        case "OR": return Number(Boolean(left) || Boolean(right));
        default: throw new Error(`Unsupported operator "${node.operator}"`);
      }
    }
    case "CallExpression": {
      if (WINDOW_FUNCTIONS.has(node.name)) {
        const evaluationContext = context ?? createFormulaEvaluationContext(Math.max(row + 1, ...Object.values(channels).map((values) => values.length)));
        return evaluateWindow(node, channels, parameters, evaluationContext)[row];
      }
      return SCALAR_FUNCTIONS[node.name](...node.arguments.map((argument) => evaluateNode(argument, row, channels, parameters, context)));
    }
  }
}

export function evaluateFormula(expression: string, channels: Record<string, Float64Array>, parameters: Record<string, number> = {}, rowCount?: number): Float64Array {
  const ast = parseFormula(expression);
  const dependencies = Array.from(collectDependencies(ast));
  dependencies.forEach((name) => { if (!channels[name]) throw new Error(`Unknown channel "${name}"`); });
  const length = rowCount ?? channels[dependencies[0]]?.length ?? 0;
  const result = new Float64Array(length);
  const context = createFormulaEvaluationContext(length);
  for (let row = 0; row < length; row += 1) result[row] = evaluateNode(ast, row, channels, parameters, context);
  return result;
}

export function hasCycle(graph: Record<string, string[]>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const dependency of graph[node] ?? []) if (graph[dependency] && visit(dependency)) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return Object.keys(graph).some(visit);
}
