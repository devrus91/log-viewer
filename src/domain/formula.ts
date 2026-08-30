export type FormulaNode =
  | { type: "Literal"; value: number }
  | { type: "ChannelReference"; name: string }
  | { type: "ParameterReference"; name: string }
  | { type: "UnaryExpression"; operator: "+" | "-" | "NOT"; argument: FormulaNode }
  | { type: "BinaryExpression"; operator: string; left: FormulaNode; right: FormulaNode }
  | { type: "CallExpression"; name: string; arguments: FormulaNode[] };

type Token = { type: "number" | "identifier" | "channel" | "operator" | "paren" | "comma"; value: string };

const FUNCTIONS: Record<string, (...values: number[]) => number> = {
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
        if (!FUNCTIONS[token.value.toLowerCase()]) throw new Error(`Unknown function "${token.value}"`);
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

export function evaluateNode(node: FormulaNode, row: number, channels: Record<string, Float64Array>, parameters: Record<string, number>): number {
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
      const value = evaluateNode(node.argument, row, channels, parameters);
      if (node.operator === "-") return -value;
      if (node.operator === "NOT") return value ? 0 : 1;
      return value;
    }
    case "BinaryExpression": {
      const left = evaluateNode(node.left, row, channels, parameters);
      const right = evaluateNode(node.right, row, channels, parameters);
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
    case "CallExpression": return FUNCTIONS[node.name](...node.arguments.map((argument) => evaluateNode(argument, row, channels, parameters)));
  }
}

export function evaluateFormula(expression: string, channels: Record<string, Float64Array>, parameters: Record<string, number> = {}, rowCount?: number): Float64Array {
  const ast = parseFormula(expression);
  const dependencies = Array.from(collectDependencies(ast));
  dependencies.forEach((name) => { if (!channels[name]) throw new Error(`Unknown channel "${name}"`); });
  const length = rowCount ?? channels[dependencies[0]]?.length ?? 0;
  const result = new Float64Array(length);
  for (let row = 0; row < length; row += 1) result[row] = evaluateNode(ast, row, channels, parameters);
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
