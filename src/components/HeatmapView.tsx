"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { datasetStore } from "@/data/dataset-store";
import { useWorkspaceStore } from "@/state/workspace-store";
import { calculateHeatmapInWorker } from "@/workers/client";
import type { HeatmapCell, HeatmapResult } from "@/domain/types";

export function HeatmapView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<HeatmapResult | null>(null);
  const [hover, setHover] = useState<HeatmapCell | null>(null);
  const [loading, setLoading] = useState(false);
  const { channels, heatmap, setHeatmap } = useWorkspaceStore();
  const channelOptions = useMemo(() => channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>), [channels]);

  useEffect(() => {
    const x = datasetStore.getColumn(heatmap.xChannelId);
    const y = datasetStore.getColumn(heatmap.yChannelId);
    const value = datasetStore.getColumn(heatmap.valueChannelId);
    if (!x || !y || !value) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setLoading(true); });
    calculateHeatmapInWorker({ x, y, value, xBins: heatmap.xBins, yBins: heatmap.yBins, aggregation: heatmap.aggregation, minSamples: heatmap.minSamples, filters: heatmap.filters.flatMap((config) => { const values = datasetStore.getColumn(config.channelId); return values ? [{ config, values }] : []; }) })
      .then((nextResult) => { if (!cancelled) setResult(nextResult); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [heatmap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio; canvas.height = height * ratio; context.scale(ratio, ratio);
    context.fillStyle = "#0b1017"; context.fillRect(0, 0, width, height);
    const pad = { left: 58, right: 20, top: 20, bottom: 42 };
    const cellWidth = (width - pad.left - pad.right) / result.xBins;
    const cellHeight = (height - pad.top - pad.bottom) / result.yBins;
    const cells = new Map(result.cells.map((cell) => [`${cell.x}:${cell.y}`, cell]));
    for (let y = 0; y < result.yBins; y += 1) for (let x = 0; x < result.xBins; x += 1) {
      const cell = cells.get(`${x}:${y}`);
      context.fillStyle = cell ? heatColor((cell.value - result.valueMin) / (result.valueMax - result.valueMin || 1)) : "#101821";
      context.fillRect(pad.left + x * cellWidth + .5, pad.top + (result.yBins - y - 1) * cellHeight + .5, Math.max(1, cellWidth - 1), Math.max(1, cellHeight - 1));
    }
    context.fillStyle = "#8290a3"; context.font = "10px IBM Plex Mono"; context.textAlign = "center";
    for (let x = 0; x <= result.xBins; x += Math.ceil(result.xBins / 6)) context.fillText(format(result.xMin + (x / result.xBins) * (result.xMax - result.xMin)), pad.left + x * cellWidth, height - 18);
    context.save(); context.translate(14, height / 2); context.rotate(-Math.PI / 2); context.fillText(channels.find((channel) => channel.id === heatmap.yChannelId)?.name ?? "Y", 0, 0); context.restore();
    context.fillText(channels.find((channel) => channel.id === heatmap.xChannelId)?.name ?? "X", width / 2, height - 3);
  }, [result, channels, heatmap.xChannelId, heatmap.yChannelId]);

  const inspect = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!result || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left - 58) / (rect.width - 78)) * result.xBins);
    const y = result.yBins - 1 - Math.floor(((event.clientY - rect.top - 20) / (rect.height - 62)) * result.yBins);
    setHover(result.cells.find((cell) => cell.x === x && cell.y === y) ?? null);
  };

  return <div className="heatmap-layout">
    <section className="heatmap-panel">
      <div className="section-kicker"><span>HEATMAP MATRIX</span><span>{loading ? "CALCULATING…" : `${result?.cells.length ?? 0} populated cells`}</span></div>
      <div className="heatmap-canvas-wrap"><canvas ref={canvasRef} onMouseMove={inspect} onMouseLeave={() => setHover(null)} />
        {hover && result && <div className="heat-tooltip"><b>{format(result.xMin + hover.x / result.xBins * (result.xMax - result.xMin))} – {format(result.xMin + (hover.x + 1) / result.xBins * (result.xMax - result.xMin))}</b><span>Value {format(hover.value)}</span><span>{hover.count} samples</span></div>}
      </div>
    </section>
    <aside className="heatmap-controls">
      <h3>Matrix setup</h3>
      <Field label="X channel"><select value={heatmap.xChannelId} onChange={(event) => setHeatmap({ xChannelId: event.target.value })}>{channelOptions}</select></Field>
      <Field label="Y channel"><select value={heatmap.yChannelId} onChange={(event) => setHeatmap({ yChannelId: event.target.value })}>{channelOptions}</select></Field>
      <Field label="Value channel"><select value={heatmap.valueChannelId} onChange={(event) => setHeatmap({ valueChannelId: event.target.value })}>{channelOptions}</select></Field>
      <div className="control-grid"><Field label="X bins"><input type="number" min={4} max={100} value={heatmap.xBins} onChange={(event) => setHeatmap({ xBins: Number(event.target.value) })} /></Field><Field label="Y bins"><input type="number" min={4} max={100} value={heatmap.yBins} onChange={(event) => setHeatmap({ yBins: Number(event.target.value) })} /></Field></div>
      <Field label="Aggregation"><select value={heatmap.aggregation} onChange={(event) => setHeatmap({ aggregation: event.target.value as typeof heatmap.aggregation })}>{["average", "min", "max", "median", "count", "sum"].map((value) => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Minimum samples"><input type="number" min={1} value={heatmap.minSamples} onChange={(event) => setHeatmap({ minSamples: Math.max(1, Number(event.target.value)) })} /></Field>
      <div className="filters-head"><h3>Filters</h3><button onClick={() => setHeatmap({ filters: [...heatmap.filters, { id: crypto.randomUUID(), channelId: channels[0]?.id ?? "", operator: ">", value: 0 }] })}><Plus size={14} /> Add</button></div>
      {heatmap.filters.map((filter) => <div className="filter-row" key={filter.id}><select value={filter.channelId} onChange={(event) => setHeatmap({ filters: heatmap.filters.map((item) => item.id === filter.id ? { ...item, channelId: event.target.value } : item) })}>{channelOptions}</select><select value={filter.operator} onChange={(event) => setHeatmap({ filters: heatmap.filters.map((item) => item.id === filter.id ? { ...item, operator: event.target.value as typeof item.operator } : item) })}>{[">", ">=", "=", "!=", "<", "<=", "between"].map((value) => <option key={value}>{value}</option>)}</select><input type="number" value={filter.value} onChange={(event) => setHeatmap({ filters: heatmap.filters.map((item) => item.id === filter.id ? { ...item, value: Number(event.target.value) } : item) })} /><button aria-label="Remove filter" onClick={() => setHeatmap({ filters: heatmap.filters.filter((item) => item.id !== filter.id) })}><Trash2 size={14} /></button></div>)}
    </aside>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function format(value: number): string { return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2); }
function heatColor(value: number): string { const hue = 210 - Math.max(0, Math.min(1, value)) * 190; return `hsl(${hue} 78% ${32 + value * 18}%)`; }
