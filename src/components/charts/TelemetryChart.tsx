"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import { datasetStore } from "@/data/dataset-store";
import { useWorkspaceStore } from "@/state/workspace-store";

interface TelemetryChartProps {
  channelIds: string[];
  height?: number;
  fillHeight?: boolean;
  title?: string;
  showXAxis?: boolean;
}

interface ChartTooltipRow { id: string; name: string; unit: string; color: string; value: number | null; active: boolean; }
interface ChartTooltipState { left: number; top: number; width: number; columns: number; xValue: number; rows: ChartTooltipRow[]; }

function buildIndices(start: number, end: number, series: Float64Array | undefined, limit = 4200): number[] {
  const length = end - start + 1;
  if (length <= limit || !series) return Array.from({ length }, (_, index) => start + index);
  const indices = [start];
  const buckets = Math.floor((limit - 2) / 2);
  const bucketSize = (length - 2) / buckets;
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const from = Math.floor(start + 1 + bucket * bucketSize);
    const to = Math.min(end, Math.floor(start + 1 + (bucket + 1) * bucketSize));
    let minIndex = from;
    let maxIndex = from;
    for (let index = from + 1; index < to; index += 1) {
      if (series[index] < series[minIndex]) minIndex = index;
      if (series[index] > series[maxIndex]) maxIndex = index;
    }
    indices.push(...(minIndex < maxIndex ? [minIndex, maxIndex] : [maxIndex, minIndex]));
  }
  indices.push(end);
  return indices;
}

export function TelemetryChart({ channelIds, height = 360, fillHeight = false, title, showXAxis = true }: TelemetryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const sourceIndicesRef = useRef<number[]>([]);
  const localCursorRef = useRef(false);
  const [chartTooltip, setChartTooltip] = useState<ChartTooltipState | null>(null);
  const { channels, xChannelId, range, axisMode, hiddenChannelIds, cursorIndex, activeChannelId, valueDisplayMode, diagnostics, diagnosticsEnabled, selectedDiagnosticId, setCursorIndex, setActiveChannel, setRange, focusDiagnostic } = useWorkspaceStore();
  const activeChannelRef = useRef(activeChannelId);

  const visibleIds = useMemo(() => channelIds.filter((id) => !hiddenChannelIds.includes(id) && datasetStore.getColumn(id)), [channelIds, hiddenChannelIds]);
  const [rangeStart, rangeEnd] = range;

  useEffect(() => { activeChannelRef.current = activeChannelId; }, [activeChannelId]);

  useEffect(() => {
    const container = containerRef.current;
    const xValues = datasetStore.getColumn(xChannelId);
    if (!container || !xValues || visibleIds.length === 0) return;
    const [start, end] = [Math.max(0, rangeStart), Math.min(xValues.length - 1, rangeEnd)];
    let indices = buildIndices(start, end, datasetStore.getColumn(visibleIds[0]));
    if (xChannelId !== datasetStore.metadata?.timeChannelId) indices = indices.sort((a, b) => xValues[a] - xValues[b]);
    sourceIndicesRef.current = indices;
    const data: uPlot.AlignedData = [indices.map((index) => xValues[index])];
    visibleIds.forEach((id) => data.push(indices.map((index) => datasetStore.getColumn(id)?.[index] ?? Number.NaN)));
    const unitScale = new Map<string, string>();
    const chartChannels = visibleIds.map((id) => channels.find((channel) => channel.id === id)).filter((channel) => channel !== undefined);
    chartChannels.forEach((channel, index) => {
      const scale = axisMode === "shared" ? "shared" : axisMode === "independent" ? `series-${index}` : `unit-${channel.unit}`;
      unitScale.set(channel.id, scale);
    });
    const scales: uPlot.Options["scales"] = { x: { time: false }, shared: { auto: true } };
    Array.from(new Set(unitScale.values())).forEach((scale) => { scales[scale] = { auto: true }; });
    const axes: uPlot.Axis[] = [{ stroke: "#64748b", grid: { stroke: "rgba(71,85,105,.22)", width: 1 }, ticks: { stroke: "#263244" }, size: showXAxis ? 32 : 8, font: "10px IBM Plex Mono, monospace" }];
    const usedScales = Array.from(new Set(unitScale.values()));
    usedScales.slice(0, 4).forEach((scale, index) => {
      const channel = chartChannels.find((item) => unitScale.get(item.id) === scale);
      axes.push({ scale, side: index % 2 === 0 ? 3 : 1, stroke: channel?.color ?? "#94a3b8", grid: { show: index === 0, stroke: "rgba(71,85,105,.2)" }, ticks: { stroke: "#263244" }, size: 48, font: "9px IBM Plex Mono, monospace", label: channel?.unit === "—" ? undefined : channel?.unit, labelSize: 14, labelFont: "9px IBM Plex Mono, monospace" });
    });
    const options: uPlot.Options = {
      width: Math.max(320, container.clientWidth),
      height: fillHeight ? Math.max(220, container.clientHeight) : height,
      padding: [10, 8, 0, 0],
      scales,
      axes,
      cursor: { drag: { x: true, y: false, setScale: true }, points: { size: 5 }, focus: { prox: 24 } },
      focus: { alpha: 0.14 },
      legend: { show: false },
      series: [
        { label: channels.find((channel) => channel.id === xChannelId)?.name ?? "X" },
        ...chartChannels.map((channel) => ({ label: channel.name, stroke: channel.color, width: 1.35, scale: unitScale.get(channel.id), points: { show: false }, spanGaps: true })),
      ],
      hooks: {
        ready: [(plot) => {
          plot.over.addEventListener("mouseleave", () => setChartTooltip(null));
          if (!diagnosticsEnabled || xChannelId !== datasetStore.metadata?.timeChannelId) return;
          plot.over.addEventListener("click", (event) => {
            const closest = (diagnostics?.events ?? []).map((item) => ({ item, distance: Math.abs(plot.valToPos(item.peakTime, "x") - event.offsetX) })).sort((a, b) => a.distance - b.distance)[0];
            if (closest && closest.distance <= 9) focusDiagnostic(closest.item);
          });
        }],
        draw: [(plot) => {
          if (!diagnosticsEnabled || xChannelId !== datasetStore.metadata?.timeChannelId || !diagnostics?.events.length) return;
          const ratio = window.devicePixelRatio || 1;
          const context = plot.ctx;
          context.save();
          for (const event of diagnostics.events.slice(0, 200)) {
            if (event.peakIndex < start || event.peakIndex > end) continue;
            const x = plot.valToPos(event.peakTime, "x", true);
            const selected = event.id === selectedDiagnosticId;
            context.strokeStyle = event.severity === "critical" ? "#fb5b68" : event.severity === "warning" ? "#f59e42" : "#4aa8ff";
            context.fillStyle = context.strokeStyle;
            context.globalAlpha = selected ? 1 : 0.72;
            context.lineWidth = (selected ? 2 : 1) * ratio;
            context.setLineDash(selected ? [] : [3 * ratio, 4 * ratio]);
            context.beginPath(); context.moveTo(x, plot.bbox.top); context.lineTo(x, plot.bbox.top + plot.bbox.height); context.stroke();
            context.setLineDash([]); context.beginPath(); context.moveTo(x, plot.bbox.top); context.lineTo(x - 5 * ratio, plot.bbox.top + 8 * ratio); context.lineTo(x + 5 * ratio, plot.bbox.top + 8 * ratio); context.closePath(); context.fill();
            if (selected) { context.font = `${9 * ratio}px IBM Plex Mono`; context.fillText(event.name, Math.min(x + 7 * ratio, plot.bbox.left + plot.bbox.width - 150 * ratio), plot.bbox.top + 16 * ratio); }
          }
          context.restore();
        }],
        setCursor: [(plot) => {
          if (plot.cursor.idx === null || plot.cursor.idx === undefined) return;
          const sourceIndex = sourceIndicesRef.current[plot.cursor.idx];
          if (sourceIndex !== undefined) {
            localCursorRef.current = true;
            setCursorIndex(sourceIndex);
            queueMicrotask(() => { localCursorRef.current = false; });
            if (valueDisplayMode === "tooltip") {
              const activeId = activeChannelRef.current;
              const rows = chartChannels.map((channel) => { const value = datasetStore.getColumn(channel.id)?.[sourceIndex]; return { id: channel.id, name: channel.name, unit: channel.unit, color: channel.color, value: value !== undefined && Number.isFinite(value) ? value : null, active: channel.id === activeId }; });
              const columns = rows.length > 8 ? 2 : 1;
              const width = columns === 2 ? 430 : 240;
              const estimatedHeight = 34 + Math.ceil(rows.length / columns) * 23;
              const left = Math.min(Math.max(8, (plot.cursor.left ?? 0) + 14), Math.max(8, container.clientWidth - width - 8));
              const top = Math.min(Math.max(8, (plot.cursor.top ?? 0) - estimatedHeight / 2), Math.max(8, container.clientHeight - estimatedHeight - 8));
              setChartTooltip({ left, top, width, columns, xValue: xValues[sourceIndex], rows });
            }
          }
        }],
        setSeries: [(_plot, seriesIndex) => {
          if (seriesIndex === null || seriesIndex < 1) return;
          const channel = chartChannels[seriesIndex - 1];
          if (channel) { activeChannelRef.current = channel.id; setActiveChannel(channel.id); }
        }],
        setScale: [(plot, key) => {
          if (key !== "x" || plot.scales.x.min === undefined || plot.scales.x.max === undefined) return;
          const xColumn = datasetStore.getColumn(xChannelId);
          if (!xColumn) return;
          let nextStart = start;
          let nextEnd = end;
          for (const index of sourceIndicesRef.current) {
            if (xColumn[index] >= (plot.scales.x.min ?? -Infinity)) { nextStart = index; break; }
          }
          for (let cursor = sourceIndicesRef.current.length - 1; cursor >= 0; cursor -= 1) {
            const index = sourceIndicesRef.current[cursor];
            if (xColumn[index] <= (plot.scales.x.max ?? Infinity)) { nextEnd = index; break; }
          }
          if (nextEnd - nextStart > 2 && (nextStart !== start || nextEnd !== end)) setRange([Math.min(nextStart, nextEnd), Math.max(nextStart, nextEnd)]);
        }],
      },
    };
    plotRef.current?.destroy();
    plotRef.current = new uPlot(options, data, container);
    const observer = new ResizeObserver(([entry]) => plotRef.current?.setSize({
      width: Math.max(320, Math.floor(entry.contentRect.width)),
      height: fillHeight ? Math.max(220, Math.floor(entry.contentRect.height)) : height,
    }));
    observer.observe(container);
    return () => { observer.disconnect(); plotRef.current?.destroy(); plotRef.current = null; };
  }, [visibleIds, xChannelId, rangeStart, rangeEnd, axisMode, height, fillHeight, showXAxis, channels, diagnostics, diagnosticsEnabled, valueDisplayMode, selectedDiagnosticId, setCursorIndex, setActiveChannel, setRange, focusDiagnostic]);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const seriesIndex = activeChannelId ? visibleIds.indexOf(activeChannelId) + 1 : 0;
    if (seriesIndex > 0) plot.setSeries(seriesIndex, { focus: true });
  }, [activeChannelId, visibleIds]);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot || cursorIndex === null || localCursorRef.current) return;
    const dataIndex = sourceIndicesRef.current.reduce((best, source, index, all) => Math.abs(source - cursorIndex) < Math.abs(all[best] - cursorIndex) ? index : best, 0);
    const x = plot.valToPos(plot.data[0][dataIndex], "x");
    plot.setCursor({ left: x, top: Math.max(0, (plot.cursor.top ?? 0)) });
  }, [cursorIndex]);

  if (visibleIds.length === 0) return <div className={`chart-empty ${fillHeight ? "fill-chart" : ""}`} style={fillHeight ? undefined : { height }}><span>SELECT CHANNELS TO BEGIN</span><small>Use the channel browser on the right</small></div>;
  return <div className={`chart-shell ${fillHeight ? "fill-chart" : ""}`}>{title && <div className="chart-watermark">{title}</div>}<div ref={containerRef} className="telemetry-chart" />{valueDisplayMode === "tooltip" && chartTooltip && <div className="chart-value-tooltip" style={{ left: chartTooltip.left, top: chartTooltip.top, width: chartTooltip.width }}><header><span>CURSOR</span><b>{formatTooltipValue(chartTooltip.xValue)} <small>X</small></b></header><div className="chart-tooltip-values" style={{ gridTemplateColumns: `repeat(${chartTooltip.columns}, minmax(0, 1fr))` }}>{chartTooltip.rows.map((row) => <div className={row.active ? "active" : ""} key={row.id}><i style={{ background: row.color }} /><span title={row.name}>{row.name}</span><b>{row.value === null ? "—" : formatTooltipValue(row.value)} <small>{row.unit === "—" ? "" : row.unit}</small></b></div>)}</div></div>}</div>;
}

function formatTooltipValue(value: number): string { return Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(2); }
