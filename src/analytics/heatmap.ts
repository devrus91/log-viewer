import type { Aggregation, HeatmapFilter, HeatmapResult } from "@/domain/types";

interface HeatmapInput {
  x: Float64Array;
  y: Float64Array;
  value: Float64Array;
  xBins: number;
  yBins: number;
  aggregation: Aggregation;
  minSamples: number;
  filters: Array<{ config: HeatmapFilter; values: Float64Array }>;
}

function finiteExtent(values: Float64Array): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
  return [min, max];
}

function passes(value: number, filter: HeatmapFilter): boolean {
  switch (filter.operator) {
    case "=": return value === filter.value;
    case "!=": return value !== filter.value;
    case ">": return value > filter.value;
    case ">=": return value >= filter.value;
    case "<": return value < filter.value;
    case "<=": return value <= filter.value;
    case "between": return value >= filter.value && value <= (filter.value2 ?? filter.value);
  }
}

export function buildHeatmap(input: HeatmapInput): HeatmapResult {
  const [xMin, xMax] = finiteExtent(input.x);
  const [yMin, yMax] = finiteExtent(input.y);
  const size = input.xBins * input.yBins;
  const count = new Uint32Array(size);
  const sum = new Float64Array(size);
  const min = new Float64Array(size); min.fill(Infinity);
  const max = new Float64Array(size); max.fill(-Infinity);
  const medianValues: number[][] | null = input.aggregation === "median" ? Array.from({ length: size }, () => []) : null;
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;
  for (let row = 0; row < input.x.length; row += 1) {
    const xValue = input.x[row];
    const yValue = input.y[row];
    const cellValue = input.value[row];
    if (![xValue, yValue, cellValue].every(Number.isFinite)) continue;
    if (input.filters.some(({ config, values }) => !passes(values[row], config))) continue;
    const xBin = Math.min(input.xBins - 1, Math.max(0, Math.floor(((xValue - xMin) / xSpan) * input.xBins)));
    const yBin = Math.min(input.yBins - 1, Math.max(0, Math.floor(((yValue - yMin) / ySpan) * input.yBins)));
    const index = yBin * input.xBins + xBin;
    count[index] += 1;
    sum[index] += cellValue;
    min[index] = Math.min(min[index], cellValue);
    max[index] = Math.max(max[index], cellValue);
    medianValues?.[index].push(cellValue);
  }
  const cells = [];
  let valueMin = Infinity;
  let valueMax = -Infinity;
  for (let y = 0; y < input.yBins; y += 1) {
    for (let x = 0; x < input.xBins; x += 1) {
      const index = y * input.xBins + x;
      if (count[index] < input.minSamples) continue;
      let value = sum[index] / count[index];
      if (input.aggregation === "min") value = min[index];
      else if (input.aggregation === "max") value = max[index];
      else if (input.aggregation === "sum") value = sum[index];
      else if (input.aggregation === "count") value = count[index];
      else if (input.aggregation === "median" && medianValues) {
        const values = medianValues[index].sort((a, b) => a - b);
        const middle = Math.floor(values.length / 2);
        value = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
      }
      valueMin = Math.min(valueMin, value);
      valueMax = Math.max(valueMax, value);
      cells.push({ x, y, value, count: count[index] });
    }
  }
  return { cells, xMin, xMax, yMin, yMax, valueMin, valueMax, xBins: input.xBins, yBins: input.yBins };
}
