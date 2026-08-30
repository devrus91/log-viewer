import { describe, expect, it } from "vitest";
import { buildHeatmap } from "@/analytics/heatmap";
import { parseCsv } from "@/data/csv";
import { datasetStore } from "@/data/dataset-store";
import { evaluateFormula } from "@/domain/formula";
import { useWorkspaceStore } from "@/state/workspace-store";

describe("CSV → chart state → formula → heatmap workflow", () => {
  it("keeps original arrays while calculated data becomes reusable", () => {
    const dataset = parseCsv("Time (s),Engine Speed (rpm),Throttle Actual (%),Boost Actual (bar),Boost Target (bar)\n0,2000,90,1.2,1.0\n0.1,2500,95,1.8,1.5\n0.2,3000,100,2.4,2.0");
    datasetStore.load(dataset);
    useWorkspaceStore.getState().setDataset(dataset.metadata, dataset.channels);
    expect(useWorkspaceStore.getState().selectedChannelIds.length).toBeGreaterThan(0);

    const actual = dataset.channels.find((channel) => channel.name === "Boost Actual (bar)")!;
    const target = dataset.channels.find((channel) => channel.name === "Boost Target (bar)")!;
    const calculated = evaluateFormula("[Boost Actual (bar)] - [Boost Target (bar)]", {
      "Boost Actual (bar)": datasetStore.getColumn(actual.id)!,
      "Boost Target (bar)": datasetStore.getColumn(target.id)!,
    });
    expect(calculated[0]).toBeCloseTo(0.2);
    expect(calculated[1]).toBeCloseTo(0.3);
    expect(calculated[2]).toBeCloseTo(0.4);

    const rpm = dataset.channels.find((channel) => channel.name === "Engine Speed (rpm)")!;
    const throttle = dataset.channels.find((channel) => channel.name === "Throttle Actual (%)")!;
    const heatmap = buildHeatmap({ x: datasetStore.getColumn(rpm.id)!, y: datasetStore.getColumn(throttle.id)!, value: calculated, xBins: 2, yBins: 2, aggregation: "average", minSamples: 1, filters: [] });
    expect(heatmap.cells.reduce((sum, cell) => sum + cell.count, 0)).toBe(3);
    expect(datasetStore.getColumn(actual.id)?.[0]).toBe(1.2);
  });
});
