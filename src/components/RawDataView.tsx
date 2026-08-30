"use client";

import { useMemo, useState } from "react";
import { datasetStore } from "@/data/dataset-store";
import { useWorkspaceStore } from "@/state/workspace-store";

export function RawDataView() {
  const { channels, selectedChannelIds, cursorIndex, setCursorIndex, metadata } = useWorkspaceStore();
  const [scrollTop, setScrollTop] = useState(0);
  const columns = useMemo(() => [metadata?.timeChannelId ?? "", ...selectedChannelIds.filter((id) => id !== metadata?.timeChannelId)].slice(0, 10), [metadata, selectedChannelIds]);
  const rowHeight = 30;
  const visibleCount = 22;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
  const rows = Array.from({ length: Math.min(visibleCount, Math.max(0, (metadata?.rows ?? 0) - start)) }, (_, index) => start + index);
  return <div className="raw-wrap" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
    <table className="raw-table"><thead><tr><th>#</th>{columns.map((id) => <th key={id}>{channels.find((channel) => channel.id === id)?.name}</th>)}</tr></thead>
      <tbody style={{ transform: `translateY(${start * rowHeight}px)` }}>{rows.map((row) => <tr key={row} className={cursorIndex === row ? "active" : ""} onClick={() => setCursorIndex(row)}><td>{row.toLocaleString()}</td>{columns.map((id) => <td key={id}>{formatValue(datasetStore.getColumn(id)?.[row])}</td>)}</tr>)}</tbody>
    </table><div style={{ height: (metadata?.rows ?? 0) * rowHeight, pointerEvents: "none" }} />
  </div>;
}

function formatValue(value: number | undefined): string { if (value === undefined || !Number.isFinite(value)) return "—"; return Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(3); }
