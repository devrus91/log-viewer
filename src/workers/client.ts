import type { Aggregation, ChannelMappingOverride, ChannelMetadata, DatasetTransfer, DiagnosticAnalysis, DiagnosticProfile, HeatmapFilter, HeatmapResult } from "@/domain/types";
import { parseCsv } from "@/data/csv";
import { evaluateFormula } from "@/domain/formula";
import { buildHeatmap } from "@/analytics/heatmap";
import { analyzeDataset } from "@/diagnostics/engine/DiagnosticEngine";

type WorkerResponse<T> = { id: string; ok: true; result: T } | { id: string; ok: false; error: string };
type Pending = { resolve: (value: unknown) => void; reject: (reason: Error) => void };

let worker: Worker | null = null;
const pending = new Map<string, Pending>();

function getWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("./data.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<WorkerResponse<unknown>>) => {
      const task = pending.get(event.data.id);
      if (!task) return;
      pending.delete(event.data.id);
      if (event.data.ok) task.resolve(event.data.result);
      else task.reject(new Error(event.data.error));
    };
  }
  return worker;
}

function runWorker<T>(payload: Record<string, unknown>): Promise<T> {
  const instance = getWorker();
  if (!instance) return Promise.reject(new Error("Workers are unavailable"));
  const id = crypto.randomUUID();
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: (value) => resolve(value as T), reject });
    instance.postMessage({ id, ...payload });
  });
}

export async function parseCsvInWorker(file: File, profile?: DiagnosticProfile, mappingOverrides: ChannelMappingOverride[] = []): Promise<DatasetTransfer> {
  const text = await file.text();
  try { return await runWorker<DatasetTransfer>({ type: "parse", text, filename: file.name, fileSize: file.size, profile, mappingOverrides }); }
  catch { const dataset = parseCsv(text, file.name, file.size); dataset.analysis = analyzeDataset({ channels: dataset.channels, columns: dataset.columns, profile, mappingOverrides }); return dataset; }
}

export async function calculateFormulaInWorker(expression: string, channels: Record<string, Float64Array>, parameters: Record<string, number>, rowCount: number): Promise<Float64Array> {
  try { return await runWorker<Float64Array>({ type: "formula", expression, channels, parameters, rowCount }); }
  catch { return evaluateFormula(expression, channels, parameters, rowCount); }
}

interface HeatmapWorkerInput {
  x: Float64Array;
  y: Float64Array;
  value: Float64Array;
  xBins: number;
  yBins: number;
  aggregation: Aggregation;
  minSamples: number;
  filters: Array<{ config: HeatmapFilter; values: Float64Array }>;
}

export async function calculateHeatmapInWorker(input: HeatmapWorkerInput): Promise<HeatmapResult> {
  try { return await runWorker<HeatmapResult>({ type: "heatmap", ...input }); }
  catch { return buildHeatmap(input); }
}

export async function runDiagnosticsInWorker(channels: ChannelMetadata[], columns: Record<string, Float64Array>, profile: DiagnosticProfile, mappingOverrides: ChannelMappingOverride[] = []): Promise<DiagnosticAnalysis> {
  try { return await runWorker<DiagnosticAnalysis>({ type: "diagnostics", channels, columns, profile, mappingOverrides }); }
  catch { return analyzeDataset({ channels, columns, profile, mappingOverrides }); }
}
