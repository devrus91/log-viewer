"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Axis3D, ChevronDown, ChevronUp, Columns3, Expand, FilePlus2, Flame, FunctionSquare, Grid3X3, Info, Maximize2, Pencil, Plus, RotateCcw, Save, Settings2, Table2, Trash2 } from "lucide-react";
import { ChannelBrowser } from "@/components/ChannelBrowser";
import { FormulaBuilder } from "@/components/FormulaBuilder";
import { HeatmapView } from "@/components/HeatmapView";
import { OverviewNavigator } from "@/components/OverviewNavigator";
import { RawDataView } from "@/components/RawDataView";
import { TelemetryChart } from "@/components/charts/TelemetryChart";
import { datasetStore } from "@/data/dataset-store";
import { loadPresets, savePresets } from "@/persistence/presets";
import { useWorkspaceStore } from "@/state/workspace-store";
import type { ViewPreset, WorkspaceMode } from "@/domain/types";
import type { DiagnosticProfile } from "@/domain/types";
import { DiagnosticsSummary } from "@/components/diagnostics/DiagnosticsSummary";
import { DiagnosticDetails } from "@/components/diagnostics/DiagnosticDetails";
import { DiagnosticRulesManager } from "@/components/diagnostics/DiagnosticRulesManager";
import { createDiagnosticRuleRepository } from "@/diagnostics/persistence/LocalStorageDiagnosticRuleRepository";
import { runDiagnosticsInWorker } from "@/workers/client";
import { WorkspaceSettings } from "@/components/WorkspaceSettings";

const MODES: Array<{ id: WorkspaceMode; label: string; icon: typeof Activity }> = [
  { id: "single", label: "Single", icon: Activity }, { id: "split", label: "Split", icon: Columns3 }, { id: "heatmap", label: "Heatmap", icon: Grid3X3 }, { id: "raw", label: "Raw", icon: Table2 },
];

export function LogWorkspace() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [formulaTargetId, setFormulaTargetId] = useState<string | null>(null);
  const [axisOpen, setAxisOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState("");
  const state = useWorkspaceStore();
  const setDiagnosticProfiles = useWorkspaceStore((store) => store.setDiagnosticProfiles);
  const setDiagnosticsEnabled = useWorkspaceStore((store) => store.setDiagnosticsEnabled);
  const setValueDisplayMode = useWorkspaceStore((store) => store.setValueDisplayMode);
  useEffect(() => { void loadPresets().then(state.setPresets); }, [state.setPresets]);
  useEffect(() => { const repository = createDiagnosticRuleRepository(); setDiagnosticProfiles(repository.initializeDiagnosticRules(), repository.getActiveProfileId()); }, [setDiagnosticProfiles]);
  useEffect(() => {
    setDiagnosticsEnabled(window.localStorage.getItem("automotive-log-viewer.diagnostics-enabled") !== "false");
    setValueDisplayMode(window.localStorage.getItem("automotive-log-viewer.value-display-mode") === "tooltip" ? "tooltip" : "panel");
  }, [setDiagnosticsEnabled, setValueDisplayMode]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") { event.preventDefault(); setFormulaTargetId(null); setFormulaOpen(true); }
      if (event.key === "Escape") { setFormulaOpen(false); setFormulaTargetId(null); setSettingsOpen(false); setRulesOpen(false); }
      if (event.key === "0") state.resetZoom();
      if (["1", "2", "3", "4"].includes(event.key) && !/input|textarea|select/i.test((event.target as Element).tagName)) state.setMode(MODES[Number(event.key) - 1].id);
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [state]);
  const saveView = async () => {
    const name = `View ${state.presets.length + 1} · ${state.metadata?.filename.replace(/\.csv$/i, "")}`;
    const preset: ViewPreset = { id: crypto.randomUUID(), name, mode: state.mode, selectedChannelIds: state.selectedChannelIds, panels: state.panels, xChannelId: state.xChannelId, range: state.range, axisMode: state.axisMode, heatmap: state.heatmap, createdAt: Date.now() };
    const presets = [...state.presets, preset]; state.setPresets(presets); await savePresets(presets); setToast(`Saved “${name}”`); setTimeout(() => setToast(""), 2400);
  };
  const smartPreset = (name: string, patterns: RegExp[]) => {
    const ids = patterns.flatMap((pattern) => { const match = state.channels.find((channel) => pattern.test(channel.name)); return match ? [match.id] : []; });
    ids.forEach((id) => { if (!state.selectedChannelIds.includes(id)) state.toggleChannel(id); });
    setToast(`${name}: ${ids.length} channels matched`); setTimeout(() => setToast(""), 2200);
  };
  const rerunDiagnostics = async (profile: DiagnosticProfile) => {
    state.setDiagnosticsRunning(true);
    try { const analysis = await runDiagnosticsInWorker(state.channels, datasetStore.getAllColumns(), profile); state.setDiagnostics(analysis); setToast(`Diagnostics complete · ${analysis.events.length} events`); setTimeout(() => setToast(""), 2400); }
    catch { state.setDiagnosticsRunning(false); setToast("Diagnostics failed"); }
  };
  const openFormula = (channelId: string | null = null) => { if (channelId) state.setActiveChannel(channelId); setFormulaTargetId(channelId); setFormulaOpen(true); };
  const activeCalculatedChannel = state.channels.find((channel) => channel.id === state.activeChannelId && channel.type === "calculated");

  return <div className="app-shell" ref={workspaceRef}>
    <header className="topbar"><div className="workspace-brand"><div className="brand-mark small"><Activity size={17} /></div><div><b>AUTOMOTIVE</b><span>LOG VIEWER</span></div></div><div className="file-crumb"><span>LOGS</span><i>/</i><b>{state.metadata?.filename}</b><small>{state.metadata?.rows.toLocaleString()} samples · {state.metadata?.channels} channels · {state.metadata?.duration.toFixed(1)}s</small></div>
      <div className="top-actions"><button onClick={() => window.location.reload()} title="Open another log"><FilePlus2 size={15} /></button><button onClick={() => void saveView()}><Save size={15} /> Save view</button><button onClick={() => workspaceRef.current?.requestFullscreen()} title="Fullscreen"><Maximize2 size={15} /></button><button className={settingsOpen ? "active" : ""} aria-label="Viewer settings" title="Settings" onClick={() => setSettingsOpen(true)}><Settings2 size={15} /></button></div></header>
    <div className="toolbar"><div className="mode-switcher">{MODES.map(({ id, label, icon: Icon }) => <button key={id} className={state.mode === id ? "active" : ""} onClick={() => state.setMode(id)}><Icon size={14} />{label}<kbd>{MODES.findIndex((mode) => mode.id === id) + 1}</kbd></button>)}</div><div className="toolbar-divider" /><label className="compact-select"><span>X AXIS</span><select value={state.xChannelId} onChange={(event) => state.setXChannel(event.target.value)}>{state.channels.map((channel) => <option value={channel.id} key={channel.id}>{channel.name}</option>)}</select></label><div className="toolbar-divider" />
      <div className="axis-control"><button className={axisOpen ? "active" : ""} onClick={() => setAxisOpen((value) => !value)}><Axis3D size={14} /> Axis: {state.axisMode}<ChevronDown size={12} /></button>{axisOpen && <div className="axis-menu"><span>Y-axis grouping</span>{(["shared", "auto", "independent"] as const).map((mode) => <button className={state.axisMode === mode ? "active" : ""} key={mode} onClick={() => { state.setAxisMode(mode); setAxisOpen(false); }}><b>{mode}</b><small>{mode === "shared" ? "One scale for every series" : mode === "auto" ? "Group automatically by unit" : "A scale per channel"}</small></button>)}</div>}</div>
      <button onClick={state.resetZoom}><RotateCcw size={14} /> Reset zoom</button><button className="formula-button" onClick={() => openFormula()}><FunctionSquare size={14} /> Formula <kbd>⌘F</kbd></button>{activeCalculatedChannel && <button onClick={() => openFormula(activeCalculatedChannel.id)}><Pencil size={14} /> Edit selected</button>}</div>
    <DiagnosticsSummary />
    <div className="content-grid"><main className={`workspace-main mode-${state.mode}`}>
      {state.mode === "single" && <SingleView />}{state.mode === "split" && <SplitView />}{state.mode === "heatmap" && <HeatmapView />}{state.mode === "raw" && <RawDataView />}
      {state.mode !== "heatmap" && state.mode !== "raw" && <OverviewNavigator />}
      <div className="statusbar"><span><i className="status-dot" /> ORIGINAL DATA</span><span>Worker ready</span><span>Render: Canvas</span><span className="status-spacer" /> <button onClick={() => smartPreset("Boost & Torque Overview", [/engine speed|rpm/i, /boost.*target/i, /boost.*actual|boost pressure/i, /throttle/i, /torque request/i, /torque actual/i])}><Flame size={11} /> Boost & Torque</button><button onClick={() => smartPreset("Wheel Speed Overview", [/vehicle speed/i, /wheel speed.*fl/i, /wheel speed.*fr/i, /wheel speed.*rl/i, /wheel speed.*rr/i])}>Wheel speed</button><span><Info size={11} /> {state.metadata?.irregularSampling ? "Irregular sampling" : `${state.metadata?.averageSampleRate.toFixed(1)} Hz`}</span></div>
    </main><ChannelBrowser onOpenRules={() => setRulesOpen(true)} onEditCalculated={(channelId) => openFormula(channelId)} /></div>
    <DiagnosticDetails />
    <WorkspaceSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenDiagnosticRules={() => { setSettingsOpen(false); setRulesOpen(true); }} />
    <DiagnosticRulesManager open={rulesOpen} onClose={() => setRulesOpen(false)} onRerun={(profile) => void rerunDiagnostics(profile)} />
    {formulaOpen && <FormulaBuilder editingChannelId={formulaTargetId} onClose={() => { setFormulaOpen(false); setFormulaTargetId(null); }} />}{toast && <div className="toast"><Save size={15} />{toast}</div>}
  </div>;
}

function SingleView() {
  const { selectedChannelIds, activeChannelId, channels, hiddenChannelIds, cursorIndex, valueDisplayMode, setActiveChannel } = useWorkspaceStore();
  return <div className="single-view"><div className="view-heading"><div><span className="eyebrow">SINGLE CHART</span><h2>Telemetry overlay</h2></div><span>Scroll to zoom · drag to select · double-click reset</span></div><TelemetryChart channelIds={selectedChannelIds} fillHeight title="SYNCHRONIZED TELEMETRY" />
    {valueDisplayMode === "panel" && <div className="legend-grid">{selectedChannelIds.map((id) => { const channel = channels.find((item) => item.id === id); if (!channel) return null; const value = cursorIndex === null ? undefined : datasetStore.getColumn(id)?.[cursorIndex]; return <button key={id} aria-pressed={activeChannelId === id} className={`${hiddenChannelIds.includes(id) ? "hidden-series" : ""} ${activeChannelId === id ? "active-series" : ""}`} onClick={() => setActiveChannel(id)}><i style={{ background: channel.color }} /><span><b>{channel.name}</b><small>{channel.unit}</small></span><strong>{format(value)}</strong><em><span>MIN {format(channel.min)}</span><span>MAX {format(channel.max)}</span></em></button>; })}</div>}</div>;
}

function SplitView() {
  const { panels, channels, addPanel, removePanel, togglePanel, moveChannelToPanel } = useWorkspaceStore();
  return <div className="split-view"><div className="view-heading"><div><span className="eyebrow">SYNCHRONIZED SPLIT</span><h2>{panels.length} linked panels</h2></div><button className="button secondary small-button" onClick={addPanel}><Plus size={13} /> Add chart</button></div>
    {panels.map((panel, index) => <section className="split-panel" key={panel.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("channel/id"); if (id) moveChannelToPanel(id, panel.id); }}><header><div><span className="drag-handle">⠿</span><b>{panel.title}</b><small>{panel.channelIds.map((id) => channels.find((channel) => channel.id === id)?.name).filter(Boolean).join(" · ") || "Drop a channel here"}</small></div><div><button onClick={() => togglePanel(panel.id)}>{panel.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button><button onClick={() => document.querySelector<HTMLElement>(`[data-panel='${panel.id}']`)?.requestFullscreen()}><Expand size={14} /></button><button onClick={() => removePanel(panel.id)} disabled={panels.length === 1}><Trash2 size={14} /></button></div></header>{!panel.collapsed && <div data-panel={panel.id}><TelemetryChart channelIds={panel.channelIds} height={panel.height} showXAxis={index === panels.length - 1} /></div>}</section>)}
  </div>;
}

function format(value: number | undefined): string { if (value === undefined || !Number.isFinite(value)) return "—"; return Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(2); }
