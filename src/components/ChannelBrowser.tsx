"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Eye, EyeOff, FunctionSquare, Pencil, Search, Settings2 } from "lucide-react";
import { datasetStore } from "@/data/dataset-store";
import { useWorkspaceStore } from "@/state/workspace-store";

export function ChannelBrowser({ onOpenRules, onEditCalculated }: { onOpenRules?: () => void; onEditCalculated?: (channelId: string) => void }) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const { channels, selectedChannelIds, activeChannelId, hiddenChannelIds, cursorIndex, toggleChannel, toggleHidden, setActiveChannel, sidebarTab, setSidebarTab, metadata, presets, applyPreset, diagnostics, diagnosticsEnabled, diagnosticFilter, setDiagnosticFilter, focusDiagnostic } = useWorkspaceStore();
  const groups = useMemo(() => {
    const result = new Map<string, typeof channels>();
    channels.filter((channel) => channel.name.toLowerCase().includes(query.toLowerCase())).forEach((channel) => {
      const group = channel.type === "calculated" ? "Calculated" : channel.group;
      result.set(group, [...(result.get(group) ?? []), channel]);
    });
    return result;
  }, [channels, query]);
  const current = (id: string) => { const value = cursorIndex === null ? undefined : datasetStore.getColumn(id)?.[cursorIndex]; return value === undefined || !Number.isFinite(value) ? "—" : Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(2); };

  return <aside className="sidebar">
    <div className={`sidebar-tabs ${diagnosticsEnabled ? "" : "three-tabs"}`}><button className={sidebarTab === "channels" ? "active" : ""} onClick={() => setSidebarTab("channels")}>Channels</button>{diagnosticsEnabled && <button className={sidebarTab === "diagnostics" ? "active" : ""} onClick={() => setSidebarTab("diagnostics")}>Diagnostics</button>}<button className={sidebarTab === "presets" ? "active" : ""} onClick={() => setSidebarTab("presets")}>Presets</button><button className={sidebarTab === "info" ? "active" : ""} onClick={() => setSidebarTab("info")}>Log info</button></div>
    {sidebarTab === "channels" && <>
      <div className="search-box"><Search size={14} /><input aria-label="Search channels" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 100–500+ channels" /><kbd>⌘ K</kbd></div>
      <div className="channel-summary"><span>{channels.length} channels</span><span>{selectedChannelIds.length} active</span></div>
      <div className="channel-list">{Array.from(groups.entries()).map(([group, items]) => <div className="channel-group" key={group}>
        <button className="group-head" onClick={() => setCollapsed((values) => values.includes(group) ? values.filter((value) => value !== group) : [...values, group])}><ChevronsUpDown size={12} /><span>{group}</span><b>{items.length}</b></button>
        {!collapsed.includes(group) && items.map((channel) => { const selected = selectedChannelIds.includes(channel.id); const hidden = hiddenChannelIds.includes(channel.id); return <div className={`channel-row ${selected ? "selected" : ""} ${activeChannelId === channel.id ? "active-channel" : ""}`} key={channel.id} draggable onDragStart={(event) => event.dataTransfer.setData("channel/id", channel.id)}>
          <button className="channel-toggle" aria-label={`Toggle ${channel.name}`} onClick={() => toggleChannel(channel.id)} style={{ borderColor: channel.color, background: selected ? channel.color : "transparent" }}>{selected && <Check size={10} />}</button>
          <button className="channel-main" onClick={() => selected ? setActiveChannel(channel.id) : toggleChannel(channel.id)}><span className="channel-name">{channel.type === "calculated" && <FunctionSquare size={12} />}{channel.name}</span><small>{channel.unit}</small></button>
          <span className="channel-value">{current(channel.id)}</span>
          {channel.type === "calculated" && <button className="channel-action" aria-label={`Edit ${channel.name}`} title="Edit calculated channel" onClick={() => onEditCalculated?.(channel.id)}><Pencil size={12} /></button>}
          {selected && <button className="eye" aria-label={hidden ? "Show channel" : "Hide channel"} onClick={() => toggleHidden(channel.id)}>{hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>}
        </div>; })}
      </div>)}</div>
    </>}
    {sidebarTab === "diagnostics" && diagnostics && <div className="diagnostics-sidebar"><div className="diagnostic-filter">{(["all", "critical", "warning", "info"] as const).map((filter) => <button className={diagnosticFilter === filter ? "active" : ""} key={filter} onClick={() => setDiagnosticFilter(filter)}>{filter}<b>{filter === "all" ? diagnostics.events.length : diagnostics.counts[filter]}</b></button>)}</div><div className="diagnostic-sidebar-head"><span>{diagnostics.pulls.length} PULLS · {diagnostics.semanticMapping.length} MAPPED</span><button onClick={onOpenRules}><Settings2 size={13} /> Rules</button></div><div className="diagnostic-event-list">{diagnostics.events.filter((event) => diagnosticFilter === "all" || event.severity === diagnosticFilter).map((event) => <button key={event.id} onClick={() => focusDiagnostic(event)}><i className={`severity-dot ${event.severity}`} /><span><b>{event.name}</b><small>{event.category} · {event.peakTime.toFixed(2)} s{event.peakRpm !== null ? ` · ${event.peakRpm.toFixed(0)} rpm` : ""}</small></span><em>{event.confidence}</em></button>)}{diagnostics.events.length === 0 && <div className="empty-side">No configured diagnostic patterns detected</div>}</div></div>}
    {sidebarTab === "presets" && <div className="preset-list"><p className="sidebar-copy">Saved layouts are local to this browser and never upload your log.</p>{presets.length === 0 && <div className="empty-side">No saved presets yet</div>}{presets.map((preset) => <button key={preset.id} onClick={() => applyPreset(preset)}><span>{preset.name}</span><small>{preset.mode} · {preset.selectedChannelIds.length} channels</small></button>)}</div>}
    {sidebarTab === "info" && metadata && <div className="log-info"><Info label="Filename" value={metadata.filename} /><Info label="File size" value={formatBytes(metadata.fileSize)} /><Info label="Rows" value={metadata.rows.toLocaleString()} /><Info label="Channels" value={metadata.channels.toString()} /><Info label="Duration" value={`${metadata.duration.toFixed(2)} s`} /><Info label="Average rate" value={`~${metadata.averageSampleRate.toFixed(1)} Hz`} /><Info label="Sample interval" value={`${metadata.minSampleInterval.toFixed(4)}–${metadata.maxSampleInterval.toFixed(4)} s`} /><Info label="Sampling" value={metadata.irregularSampling ? "Irregular" : "Regular"} /></div>}
  </aside>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div>; }
function formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 ** 2).toFixed(1)} MB`; }
