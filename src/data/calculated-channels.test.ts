import { describe, expect, it } from "vitest";
import { evaluateFormula } from "@/domain/formula";
import type { CalculatedChannelDefinition, ChannelMetadata } from "@/domain/types";
import { materializeCalculatedChannels } from "./calculated-channels";

const baseChannels: ChannelMetadata[] = [{
  id: "rpm",
  name: "Engine Speed",
  originalName: "Engine Speed",
  unit: "rpm",
  group: "Engine",
  type: "number",
  min: 1000,
  max: 3000,
  average: 2000,
  sampleCount: 3,
  color: "#22d3ee",
}];

function definition(patch: Partial<CalculatedChannelDefinition>): CalculatedChannelDefinition {
  return {
    id: "calc-scaled-rpm",
    name: "Scaled RPM",
    unit: "krpm",
    expression: "[Engine Speed] / SCALE",
    parameters: { SCALE: 1000 },
    color: "#f472b6",
    createdAt: 1,
    ...patch,
  };
}

const evaluate = async (expression: string, channels: Record<string, Float64Array>, parameters: Record<string, number>, rowCount: number) => evaluateFormula(expression, channels, parameters, rowCount);

describe("calculated channel materialization", () => {
  it("restores dependent calculated channels in dependency order", async () => {
    const dependent = definition({ id: "calc-double", name: "Double RPM", expression: "[Scaled RPM] * 2" });
    const scaled = definition({});

    const result = await materializeCalculatedChannels([dependent, scaled], baseChannels, { rpm: new Float64Array([1000, 2000, 3000]) }, 3, evaluate);

    expect(result.map(({ channel }) => channel.name)).toEqual(["Scaled RPM", "Double RPM"]);
    expect(Array.from(result[0].values)).toEqual([1, 2, 3]);
    expect(Array.from(result[1].values)).toEqual([2, 4, 6]);
    expect(result[1].channel.average).toBe(4);
  });

  it("skips incompatible, invalid and underconfigured definitions", async () => {
    const definitions = [
      definition({ id: "missing-channel", expression: "[Vehicle Speed] * 2" }),
      definition({ id: "invalid", expression: "eval(1)" }),
      definition({ id: "missing-parameter", parameters: {} }),
    ];

    const result = await materializeCalculatedChannels(definitions, baseChannels, { rpm: new Float64Array([1000, 2000, 3000]) }, 3, evaluate);

    expect(result).toEqual([]);
  });
});
