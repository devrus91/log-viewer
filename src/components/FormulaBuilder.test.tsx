import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCsv } from "@/data/csv";
import { datasetStore } from "@/data/dataset-store";
import type { CalculatedChannelDefinition, ChannelMetadata } from "@/domain/types";
import { loadCalculatedChannelDefinitions, saveCalculatedChannelDefinition } from "@/persistence/calculated-channels";
import { useWorkspaceStore } from "@/state/workspace-store";
import { FormulaBuilder } from "./FormulaBuilder";

vi.mock("@/workers/client", async () => {
  const { evaluateFormula } = await import("@/domain/formula");
  return { calculateFormulaInWorker: async (expression: string, channels: Record<string, Float64Array>, parameters: Record<string, number>, rowCount: number) => evaluateFormula(expression, channels, parameters, rowCount) };
});

const definition: CalculatedChannelDefinition = {
  id: "calc-scaled-rpm",
  name: "Scaled RPM",
  unit: "krpm",
  expression: "[Engine Speed] / SCALE",
  parameters: { SCALE: 1000 },
  color: "#f472b6",
  createdAt: 123,
};

describe("FormulaBuilder editing", () => {
  beforeEach(() => {
    window.localStorage.clear();
    const dataset = parseCsv("Time,Engine Speed\n0,1000\n1,2000");
    datasetStore.load(dataset);
    useWorkspaceStore.getState().setDataset(dataset.metadata, dataset.channels);
    saveCalculatedChannelDefinition(definition);
    const channel: ChannelMetadata = { ...dataset.channels[1], id: definition.id, name: definition.name, originalName: definition.name, unit: definition.unit, group: "Calculated", type: "calculated", min: 1, max: 2, average: 1.5, color: definition.color, expression: definition.expression };
    datasetStore.setColumn(channel, new Float64Array([1, 2]));
    useWorkspaceStore.getState().addCalculatedChannel(channel);
  });

  it("prefills and saves the selected calculated channel", async () => {
    const onClose = vi.fn();
    render(<FormulaBuilder editingChannelId={definition.id} onClose={onClose} />);

    expect((screen.getByLabelText("Channel name") as HTMLInputElement).value).toBe("Scaled RPM");
    expect((screen.getByLabelText("Unit") as HTMLInputElement).value).toBe("krpm");
    expect((screen.getByLabelText("Expression") as HTMLTextAreaElement).value).toBe(definition.expression);
    const parameterInput = screen.getByDisplayValue("1000");
    fireEvent.change(parameterInput, { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(loadCalculatedChannelDefinitions()[0].parameters).toEqual({ SCALE: 500 });
    expect(Array.from(datasetStore.getColumn(definition.id)!)).toEqual([2, 4]);
    expect(useWorkspaceStore.getState().channels.filter((channel) => channel.id === definition.id)).toHaveLength(1);
  });
});
