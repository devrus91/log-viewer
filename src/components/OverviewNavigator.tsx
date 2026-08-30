"use client";

import { useEffect, useRef } from "react";
import { datasetStore } from "@/data/dataset-store";
import { useWorkspaceStore } from "@/state/workspace-store";

export function OverviewNavigator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { metadata, selectedChannelIds, range, diagnostics, setRange } = useWorkspaceStore();
  useEffect(() => {
    const canvas = canvasRef.current;
    const values = datasetStore.getColumn(selectedChannelIds[0]);
    if (!canvas || !values) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    let min = Infinity; let max = -Infinity;
    for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
    context.beginPath(); context.strokeStyle = "#43b7c8"; context.lineWidth = 1;
    const step = Math.max(1, Math.floor(values.length / width));
    for (let index = 0; index < values.length; index += step) {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((values[index] - min) / (max - min || 1)) * (height - 8) - 4;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
    const startX = (range[0] / Math.max(1, values.length - 1)) * width;
    const endX = (range[1] / Math.max(1, values.length - 1)) * width;
    context.fillStyle = "rgba(67,183,200,.12)"; context.fillRect(startX, 0, Math.max(2, endX - startX), height);
    context.strokeStyle = "#43b7c8"; context.strokeRect(startX + .5, .5, Math.max(2, endX - startX - 1), height - 1);
    for (const event of diagnostics?.events.slice(0, 200) ?? []) {
      const x = (event.peakIndex / Math.max(1, values.length - 1)) * width;
      context.strokeStyle = event.severity === "critical" ? "#fb5b68" : event.severity === "warning" ? "#f59e42" : "#4aa8ff";
      context.globalAlpha = .85; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 9); context.stroke();
    }
    context.globalAlpha = 1;
  }, [metadata, selectedChannelIds, range, diagnostics]);
  if (!metadata) return null;
  const max = Math.max(1, metadata.rows - 1);
  return <div className="overview">
    <div className="overview-label"><span>OVERVIEW</span><span>{range[0].toLocaleString()} — {range[1].toLocaleString()} / {max.toLocaleString()} samples</span></div>
    <div className="overview-track"><canvas ref={canvasRef} />
      <input aria-label="Range start" type="range" min={0} max={max} value={range[0]} onChange={(event) => setRange([Math.min(Number(event.target.value), range[1] - 1), range[1]])} />
      <input aria-label="Range end" type="range" min={0} max={max} value={range[1]} onChange={(event) => setRange([range[0], Math.max(Number(event.target.value), range[0] + 1)])} />
    </div>
  </div>;
}
