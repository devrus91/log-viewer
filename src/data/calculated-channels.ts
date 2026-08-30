import { collectDependencies, collectParameters, parseFormula } from "@/domain/formula";
import type { CalculatedChannelDefinition, ChannelMetadata } from "@/domain/types";

type FormulaEvaluator = (expression: string, channels: Record<string, Float64Array>, parameters: Record<string, number>, rowCount: number) => Promise<Float64Array>;

export interface MaterializedCalculatedChannel {
  channel: ChannelMetadata;
  values: Float64Array;
}

function metadata(definition: CalculatedChannelDefinition, values: Float64Array): ChannelMetadata {
  let min = Infinity; let max = -Infinity; let sum = 0; let count = 0;
  for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); sum += value; count += 1; }
  return { id: definition.id, name: definition.name, originalName: definition.name, unit: definition.unit, group: "Calculated", type: "calculated", min, max, average: count ? sum / count : Number.NaN, sampleCount: count, color: definition.color, expression: definition.expression };
}

export async function materializeCalculatedChannels(definitions: CalculatedChannelDefinition[], baseChannels: ChannelMetadata[], columns: Record<string, Float64Array>, rowCount: number, evaluate: FormulaEvaluator): Promise<MaterializedCalculatedChannel[]> {
  const namedColumns: Record<string, Float64Array> = {};
  baseChannels.forEach((channel) => { const values = columns[channel.id]; if (values) namedColumns[channel.name] = values; });
  let pending = definitions.map((definition) => structuredClone(definition));
  const result: MaterializedCalculatedChannel[] = [];
  while (pending.length) {
    let progressed = false;
    const deferred: CalculatedChannelDefinition[] = [];
    for (const definition of pending) {
      try {
        const ast = parseFormula(definition.expression);
        const dependencies = Array.from(collectDependencies(ast));
        const parameters = Array.from(collectParameters(ast));
        if (parameters.some((name) => definition.parameters[name] === undefined)) continue;
        if (dependencies.some((name) => !namedColumns[name])) { deferred.push(definition); continue; }
        const values = await evaluate(definition.expression, namedColumns, definition.parameters, rowCount);
        const channel = metadata(definition, values);
        namedColumns[channel.name] = values;
        result.push({ channel, values });
        progressed = true;
      } catch { /* Invalid stored definitions must not block log import. */ }
    }
    if (!progressed) break;
    pending = deferred;
  }
  return result;
}
