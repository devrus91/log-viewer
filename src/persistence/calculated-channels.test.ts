import { beforeEach, describe, expect, it } from "vitest";
import type { CalculatedChannelDefinition } from "@/domain/types";
import { CALCULATED_CHANNELS_KEY, loadCalculatedChannelDefinitions, saveCalculatedChannelDefinition } from "./calculated-channels";

const definition: CalculatedChannelDefinition = {
  id: "calc-boost-error",
  name: "Boost Error",
  unit: "bar",
  expression: "[Boost Actual] - [Boost Target]",
  parameters: { SCALE: 1 },
  color: "#f472b6",
  createdAt: 123,
};

describe("calculated channel persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores and restores complete channel definitions", () => {
    saveCalculatedChannelDefinition(definition);

    expect(loadCalculatedChannelDefinitions()).toEqual([definition]);
  });

  it("updates a channel with the same name without creating a duplicate", () => {
    saveCalculatedChannelDefinition(definition);
    const saved = saveCalculatedChannelDefinition({ ...definition, id: "new-id", expression: "[Boost Actual]", createdAt: 999 });

    expect(saved.id).toBe(definition.id);
    expect(saved.createdAt).toBe(definition.createdAt);
    expect(loadCalculatedChannelDefinitions()).toEqual([{ ...definition, expression: "[Boost Actual]" }]);
  });

  it("ignores corrupted local storage data", () => {
    window.localStorage.setItem(CALCULATED_CHANNELS_KEY, "not-json");

    expect(loadCalculatedChannelDefinitions()).toEqual([]);
  });
});
