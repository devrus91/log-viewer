/// <reference lib="webworker" />
import { parseCsv } from "@/data/csv";
import { evaluateFormula } from "@/domain/formula";
import { buildHeatmap } from "@/analytics/heatmap";
import type { Aggregation, HeatmapFilter } from "@/domain/types";
import type { ChannelMappingOverride, ChannelMetadata, DiagnosticProfile } from "@/domain/types";
import { analyzeDataset } from "@/diagnostics/engine/DiagnosticEngine";

type WorkerRequest =
  | { id: string; type: "parse"; text: string; filename: string; fileSize: number; profile?: DiagnosticProfile; mappingOverrides?: ChannelMappingOverride[] }
  | { id: string; type: "formula"; expression: string; channels: Record<string, Float64Array>; parameters: Record<string, number>; rowCount: number }
  | { id: string; type: "heatmap"; x: Float64Array; y: Float64Array; value: Float64Array; xBins: number; yBins: number; aggregation: Aggregation; minSamples: number; filters: Array<{ config: HeatmapFilter; values: Float64Array }> }
  | { id: string; type: "diagnostics"; channels: ChannelMetadata[]; columns: Record<string, Float64Array>; profile: DiagnosticProfile; mappingOverrides?: ChannelMappingOverride[] };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "parse") {
      const dataset = parseCsv(request.text, request.filename, request.fileSize);
      dataset.analysis = analyzeDataset({ channels: dataset.channels, columns: dataset.columns, profile: request.profile, mappingOverrides: request.mappingOverrides });
      self.postMessage({ id: request.id, ok: true, result: dataset }, Object.values(dataset.columns).map((column) => column.buffer));
    } else if (request.type === "formula") {
      const values = evaluateFormula(request.expression, request.channels, request.parameters, request.rowCount);
      self.postMessage({ id: request.id, ok: true, result: values }, [values.buffer]);
    } else if (request.type === "heatmap") {
      const result = buildHeatmap(request);
      self.postMessage({ id: request.id, ok: true, result });
    } else {
      const result = analyzeDataset(request);
      self.postMessage({ id: request.id, ok: true, result });
    }
  } catch (error) {
    self.postMessage({ id: request.id, ok: false, error: error instanceof Error ? error.message : "Worker task failed" });
  }
};

export {};
