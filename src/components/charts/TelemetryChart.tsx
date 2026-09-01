"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import { datasetStore } from "@/data/dataset-store";
import { useWorkspaceStore } from "@/state/workspace-store";
import { CHART_FONT_SIZES, CHART_LINE_WIDTHS, SERIES_DASH_PATTERNS, diagnosticMarkerVisible, filterTooltipRows, formatChartValue, gridStroke, interpolateValue } from "./chart-preferences";
import { resolveTooltipLeft } from "./tooltip-position";

interface TelemetryChartProps {
  channelIds: string[];
  height?: number;
  fillHeight?: boolean;
  title?: string;
  showXAxis?: boolean;
}

interface ChartTooltipRow { id: string; name: string; unit: string; color: string; value: number | null; active: boolean; pinned: boolean; }
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
  const figureId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const sourceIndicesRef = useRef<number[]>([]);
  const localCursorRef = useRef(false);
  const [chartTooltip, setChartTooltip] = useState<ChartTooltipState | null>(null);
  const {
    channels, xChannelId, range, axisMode, hiddenChannelIds, cursorIndex, activeChannelId,
    valueDisplayMode, tooltipPosition, nearestChannelFocusEnabled, chartTextSize,
    seriesDifferentiation, chartLineThickness, chartContrast, crosshairMode, tooltipContents,
    valuePrecision, cursorSampling, gridVisibility, wheelZoomMode, diagnosticMarkerMode,
    pinnedTooltipChannelIds, diagnostics, diagnosticsEnabled, selectedDiagnosticId,
    setCursorIndex, setActiveChannel, setRange, focusDiagnostic,
  } = useWorkspaceStore();
  const activeChannelRef = useRef(activeChannelId);
  const [systemHighContrast, setSystemHighContrast] = useState(false);

  const visibleIds = useMemo(() => channelIds.filter((id) => !hiddenChannelIds.includes(id) && datasetStore.getColumn(id)), [channelIds, hiddenChannelIds]);
  const [rangeStart, rangeEnd] = range;
  const highContrast = chartContrast === "high" || (chartContrast === "system" && systemHighContrast);

  useEffect(() => { activeChannelRef.current = activeChannelId; }, [activeChannelId]);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-contrast: more)");
    const update = () => setSystemHighContrast(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

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
    const markerEvents = diagnosticsEnabled ? (diagnostics?.events ?? []).filter((event) => diagnosticMarkerVisible(event.severity, diagnosticMarkerMode)) : [];
    const fontSizes = CHART_FONT_SIZES[chartTextSize];
    const gridVisible = gridVisibility !== "off";
    const gridColor = gridStroke(gridVisibility, highContrast);
    const lineWidth = CHART_LINE_WIDTHS[chartLineThickness] + (highContrast ? .25 : 0);
    chartChannels.forEach((channel, index) => {
      const scale = axisMode === "shared" ? "shared" : axisMode === "independent" ? `series-${index}` : `unit-${channel.unit}`;
      unitScale.set(channel.id, scale);
    });
    const scales: uPlot.Options["scales"] = { x: { time: false }, shared: { auto: true } };
    Array.from(new Set(unitScale.values())).forEach((scale) => { scales[scale] = { auto: true }; });
    const axes: uPlot.Axis[] = [{ stroke: highContrast ? "#d0deea" : "#94a3b8", grid: { show: gridVisible, stroke: gridColor, width: gridVisibility === "strong" ? 1.25 : 1 }, ticks: { stroke: highContrast ? "#7690a8" : "#3d4e61" }, size: showXAxis ? 34 : 8, font: `${fontSizes.axis}px IBM Plex Mono, monospace` }];
    const usedScales = Array.from(new Set(unitScale.values()));
    usedScales.slice(0, 4).forEach((scale, index) => {
      const channel = chartChannels.find((item) => unitScale.get(item.id) === scale);
      axes.push({ scale, side: index % 2 === 0 ? 3 : 1, stroke: channel?.color ?? "#94a3b8", grid: { show: index === 0 && gridVisible, stroke: gridColor, width: gridVisibility === "strong" ? 1.25 : 1 }, ticks: { stroke: highContrast ? "#7690a8" : "#3d4e61" }, size: 52, font: `${fontSizes.axis}px IBM Plex Mono, monospace`, label: channel?.unit === "—" ? undefined : channel?.unit, labelSize: 16, labelFont: `${fontSizes.label}px IBM Plex Mono, monospace` });
    });
    const options: uPlot.Options = {
      width: Math.max(320, container.clientWidth),
      height: fillHeight ? Math.max(220, container.clientHeight) : height,
      padding: [10, 8, 0, 0],
      scales,
      axes,
      cursor: { x: crosshairMode !== "off", y: crosshairMode === "both", drag: { x: true, y: false, setScale: true }, points: { size: 5 }, focus: { prox: nearestChannelFocusEnabled ? 24 : -1 } },
      focus: { alpha: highContrast ? .28 : .14 },
      legend: { show: false },
      series: [
        { label: channels.find((channel) => channel.id === xChannelId)?.name ?? "X" },
        ...chartChannels.map((channel, index) => ({ label: channel.name, stroke: channel.color, width: lineWidth, dash: seriesDifferentiation === "patterns" ? SERIES_DASH_PATTERNS[index % SERIES_DASH_PATTERNS.length] : [], scale: unitScale.get(channel.id), points: { show: false }, spanGaps: true })),
      ],
      hooks: {
        ready: [(plot) => {
          plot.over.addEventListener("mouseleave", () => setChartTooltip(null));
          plot.over.addEventListener("wheel", (event) => {
            if (wheelZoomMode === "disabled" || (wheelZoomMode === "modifier" && !event.ctrlKey && !event.metaKey)) return;
            if (plot.scales.x.min === undefined || plot.scales.x.max === undefined) return;
            event.preventDefault();
            const anchor = plot.posToVal(event.offsetX, "x");
            const factor = event.deltaY > 0 ? 1.18 : .84;
            plot.setScale("x", { min: anchor - (anchor - plot.scales.x.min) * factor, max: anchor + (plot.scales.x.max - anchor) * factor });
          }, { passive: false });
          if (markerEvents.length && xChannelId === datasetStore.metadata?.timeChannelId) plot.over.addEventListener("click", (event) => {
            const closest = markerEvents.map((item) => ({ item, distance: Math.abs(plot.valToPos(item.peakTime, "x") - event.offsetX) })).sort((a, b) => a.distance - b.distance)[0];
            if (closest && closest.distance <= 9) focusDiagnostic(closest.item);
          });
        }],
        draw: [(plot) => {
          if (xChannelId !== datasetStore.metadata?.timeChannelId || markerEvents.length === 0) return;
          const ratio = window.devicePixelRatio || 1;
          const context = plot.ctx;
          context.save();
          for (const event of markerEvents.slice(0, 200)) {
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
              const dataIndex = plot.cursor.idx;
              const cursorX = plot.posToVal(plot.cursor.left ?? 0, "x");
              const currentX = plot.data[0][dataIndex];
              const neighborDataIndex = cursorX >= currentX ? Math.min(plot.data[0].length - 1, dataIndex + 1) : Math.max(0, dataIndex - 1);
              const neighborSourceIndex = sourceIndicesRef.current[neighborDataIndex];
              const neighborX = plot.data[0][neighborDataIndex];
              const interpolationRatio = neighborX === currentX ? 0 : (cursorX - currentX) / (neighborX - currentX);
              const allRows = chartChannels.map((channel) => {
                const column = datasetStore.getColumn(channel.id);
                const nearestValue = column?.[sourceIndex];
                const value = cursorSampling === "interpolated" && neighborDataIndex !== dataIndex ? interpolateValue(nearestValue, column?.[neighborSourceIndex], interpolationRatio) : nearestValue;
                return { id: channel.id, name: channel.name, unit: channel.unit, color: channel.color, value: value !== undefined && value !== null && Number.isFinite(value) ? value : null, active: nearestChannelFocusEnabled && channel.id === activeId, pinned: pinnedTooltipChannelIds.includes(channel.id) };
              });
              const rows = filterTooltipRows(allRows, tooltipContents, nearestChannelFocusEnabled);
              const columns = rows.length > 8 ? 2 : 1;
              const width = columns === 2 ? 430 : 240;
              const estimatedHeight = 34 + Math.ceil(rows.length / columns) * 23;
              const cursorLeft = plot.over.offsetLeft + (plot.cursor.left ?? 0);
              const cursorTop = plot.over.offsetTop + (plot.cursor.top ?? 0);
              const left = resolveTooltipLeft({ cursorLeft, tooltipWidth: width, containerWidth: container.clientWidth, preference: tooltipPosition });
              const top = Math.min(Math.max(8, cursorTop - estimatedHeight / 2), Math.max(8, container.clientHeight - estimatedHeight - 8));
              setChartTooltip({ left, top, width, columns, xValue: cursorSampling === "interpolated" ? cursorX : xValues[sourceIndex], rows });
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
  }, [visibleIds, xChannelId, rangeStart, rangeEnd, axisMode, height, fillHeight, showXAxis, channels, diagnostics, diagnosticsEnabled, valueDisplayMode, tooltipPosition, nearestChannelFocusEnabled, chartTextSize, seriesDifferentiation, chartLineThickness, crosshairMode, tooltipContents, valuePrecision, cursorSampling, gridVisibility, wheelZoomMode, diagnosticMarkerMode, pinnedTooltipChannelIds, highContrast, selectedDiagnosticId, setCursorIndex, setActiveChannel, setRange, focusDiagnostic]);

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
  const accessibleIndex = cursorIndex ?? rangeStart;
  const xChannel = channels.find((channel) => channel.id === xChannelId);
  const accessibleRows = visibleIds.map((id) => channels.find((channel) => channel.id === id)).filter((channel) => channel !== undefined);
  const handleChartKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = cursorIndex ?? rangeStart;
    const next = event.key === "Home" ? rangeStart : event.key === "End" ? rangeEnd : event.key === "ArrowLeft" ? current - 1 : current + 1;
    setCursorIndex(Math.min(rangeEnd, Math.max(rangeStart, next)));
  };
  return <figure tabIndex={0} onKeyDown={handleChartKeyDown} className={`chart-shell chart-text-${chartTextSize} ${highContrast ? "chart-contrast-high" : ""} ${fillHeight ? "fill-chart" : ""}`} aria-labelledby={`${figureId}-title`} aria-describedby={`${figureId}-summary`}>
    <figcaption className="visually-hidden"><span id={`${figureId}-title`}>{title ?? "Telemetry chart"}</span><span id={`${figureId}-summary`}>Line chart with {accessibleRows.length} visible series. The displayed sample range is {rangeStart.toLocaleString()} through {rangeEnd.toLocaleString()}. Use Left and Right Arrow to move through samples, Home or End to jump within the range, and the accessible data disclosure for numeric values.</span></figcaption>
    {title && <div className="chart-watermark" aria-hidden="true">{title}</div>}<div ref={containerRef} className="telemetry-chart" aria-hidden="true" />
    <details className="chart-data-disclosure"><summary>Accessible data</summary><div className="chart-data-panel"><p>{xChannel?.name ?? "X axis"}: sample {accessibleIndex.toLocaleString()} within range {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}</p><table><caption>Visible telemetry series</caption><thead><tr><th scope="col">Channel</th><th scope="col">Current</th><th scope="col">Minimum</th><th scope="col">Maximum</th></tr></thead><tbody>{accessibleRows.map((channel) => { const value = datasetStore.getColumn(channel.id)?.[accessibleIndex]; const unit = channel.unit === "—" ? "" : ` ${channel.unit}`; return <tr key={channel.id}><th scope="row">{channel.name}</th><td>{formatChartValue(value, valuePrecision, "Not available")}{unit}</td><td>{formatChartValue(channel.min, valuePrecision, "Not available")}{unit}</td><td>{formatChartValue(channel.max, valuePrecision, "Not available")}{unit}</td></tr>; })}</tbody></table></div></details>
    {valueDisplayMode === "tooltip" && chartTooltip && <div className="chart-value-tooltip" aria-hidden="true" style={{ left: chartTooltip.left, top: chartTooltip.top, width: chartTooltip.width }}><header><span>CURSOR · {cursorSampling === "interpolated" ? "INTERPOLATED" : "SAMPLE"}</span><b>{formatChartValue(chartTooltip.xValue, valuePrecision)} <small>X</small></b></header><div className="chart-tooltip-values" style={{ gridTemplateColumns: `repeat(${chartTooltip.columns}, minmax(0, 1fr))` }}>{chartTooltip.rows.map((row) => <div className={`${row.active ? "active" : ""} ${row.pinned ? "pinned" : ""}`} key={row.id}><i style={{ background: row.color }} /><span title={row.name}>{row.name}</span><b>{formatChartValue(row.value, valuePrecision)} <small>{row.unit === "—" ? "" : row.unit}</small></b></div>)}</div></div>}
  </figure>;
}
