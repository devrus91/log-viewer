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
import type { ChannelMappingOverride, ViewPreset, WorkspaceMode } from "@/domain/types";
import type { DiagnosticProfile } from "@/domain/types";
import { DiagnosticsSummary } from "@/components/diagnostics/DiagnosticsSummary";
import { DiagnosticDetails } from "@/components/diagnostics/DiagnosticDetails";
import { DiagnosticRulesManager } from "@/components/diagnostics/DiagnosticRulesManager";
import { createDiagnosticRuleRepository } from "@/diagnostics/persistence/LocalStorageDiagnosticRuleRepository";
import { runDiagnosticsInWorker } from "@/workers/client";
import { WorkspaceSettings } from "@/components/WorkspaceSettings";
import { formatChartValue } from "@/components/charts/chart-preferences";
import { WotLabBrand } from "@/components/WotLabBrand";
import { ChannelMappingManager } from "@/components/diagnostics/ChannelMappingManager";
import { loadChannelMappingOverrides } from "@/diagnostics/persistence/channel-mappings";

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
  const [mappingOpen, setMappingOpen] = useState(false);
  const [toast, setToast] = useState("");
  const state = useWorkspaceStore();
  const setDiagnosticProfiles = useWorkspaceStore((store) => store.setDiagnosticProfiles);
  const hydratePreferences = useWorkspaceStore((store) => store.hydratePreferences);
  useEffect(() => { void loadPresets().then(state.setPresets); }, [state.setPresets]);
  useEffect(() => { const repository = createDiagnosticRuleRepository(); setDiagnosticProfiles(repository.initializeDiagnosticRules(), repository.getActiveProfileId()); }, [setDiagnosticProfiles]);
  useEffect(() => { hydratePreferences(window.localStorage); }, [hydratePreferences]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") { event.preventDefault(); setFormulaTargetId(null); setFormulaOpen(true); }
      if (event.key === "Escape") { setFormulaOpen(false); setFormulaTargetId(null); setSettingsOpen(false); setRulesOpen(false); setMappingOpen(false); }
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
  const rerunDiagnostics = async (profile: DiagnosticProfile, mappingOverrides: ChannelMappingOverride[] = loadChannelMappingOverrides()) => {
    state.setDiagnosticsRunning(true);
    try { const analysis = await runDiagnosticsInWorker(state.channels, datasetStore.getAllColumns(), profile, mappingOverrides); state.setDiagnostics(analysis); setToast(`Diagnostics complete · ${analysis.events.length} events`); setTimeout(() => setToast(""), 2400); }
    catch { state.setDiagnosticsRunning(false); setToast("Diagnostics failed"); }
  };
  const openAnotherLog = () => { datasetStore.clear(); state.closeDataset(); };
  const openFormula = (channelId: string | null = null) => { if (channelId) state.setActiveChannel(channelId); setFormulaTargetId(channelId); setFormulaOpen(true); };
  const activeCalculatedChannel = state.channels.find((channel) => channel.id === state.activeChannelId && channel.type === "calculated");

  return <div className="app-shell" ref={workspaceRef}>
    <header className="topbar"><div className="workspace-brand"><WotLabBrand compact /></div><div className="file-crumb"><span>LOGS</span><i>/</i><b>{state.metadata?.filename}</b><small>{state.metadata?.rows.toLocaleString()} samples · {state.metadata?.channels} channels · {state.metadata?.duration.toFixed(1)}s</small></div>
      <div className="top-actions"><button onClick={openAnotherLog} title="Choose another log"><FilePlus2 size={15} /></button><button onClick={() => void saveView()}><Save size={15} /> Save view</button><button onClick={() => workspaceRef.current?.requestFullscreen()} title="Fullscreen"><Maximize2 size={15} /></button><button className={settingsOpen ? "active" : ""} aria-label="Viewer settings" title="Settings" onClick={() => setSettingsOpen(true)}><Settings2 size={15} /></button></div></header>
    <div className="toolbar"><div className="mode-switcher" aria-label="Workspace view">{MODES.map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={state.mode === id} className={state.mode === id ? "active" : ""} onClick={() => state.setMode(id)}><Icon size={14} />{label}<kbd>{MODES.findIndex((mode) => mode.id === id) + 1}</kbd></button>)}</div><div className="toolbar-divider" /><label className="compact-select"><span>X AXIS</span><select value={state.xChannelId} onChange={(event) => state.setXChannel(event.target.value)}>{state.channels.map((channel) => <option value={channel.id} key={channel.id}>{channel.name}</option>)}</select></label><div className="toolbar-divider" />
      <div className="axis-control"><button className={axisOpen ? "active" : ""} aria-expanded={axisOpen} onClick={() => setAxisOpen((value) => !value)}><Axis3D size={14} /> Axis: {state.axisMode}<ChevronDown size={12} /></button>{axisOpen && <div className="axis-menu"><span>Y-axis grouping</span>{(["shared", "auto", "independent"] as const).map((mode) => <button aria-pressed={state.axisMode === mode} className={state.axisMode === mode ? "active" : ""} key={mode} onClick={() => { state.setAxisMode(mode); setAxisOpen(false); }}><b>{mode}</b><small>{mode === "shared" ? "One scale for every series" : mode === "auto" ? "Group automatically by unit" : "A scale per channel"}</small></button>)}</div>}</div>
      <button onClick={state.resetZoom}><RotateCcw size={14} /> Reset zoom</button><button className="formula-button" title="Formula Builder" onClick={() => openFormula()}><FunctionSquare size={14} /> <span>Formula</span> <kbd>Ctrl/⌘+F</kbd></button>{activeCalculatedChannel && <button onClick={() => openFormula(activeCalculatedChannel.id)}><Pencil size={14} /> Edit selected</button>}</div>
    <DiagnosticsSummary />
    <div className="content-grid"><main className={`workspace-main mode-${state.mode}`}>
      {state.mode === "single" && <SingleView />}{state.mode === "split" && <SplitView />}{state.mode === "heatmap" && <HeatmapView />}{state.mode === "raw" && <RawDataView />}
      {state.mode !== "heatmap" && state.mode !== "raw" && <OverviewNavigator />}
      <div className="statusbar"><span><i className="status-dot" /> ORIGINAL DATA</span><span>Worker ready</span><span>Render: Canvas</span><span className="status-spacer" /> <button onClick={() => smartPreset("Boost & Torque Overview", [/engine speed|rpm/i, /boost.*target/i, /boost.*actual|boost pressure/i, /throttle/i, /torque request/i, /torque actual/i])}><Flame size={11} /> Boost & Torque</button><button onClick={() => smartPreset("Wheel Speed Overview", [/vehicle speed/i, /wheel speed.*fl/i, /wheel speed.*fr/i, /wheel speed.*rl/i, /wheel speed.*rr/i])}>Wheel speed</button><span><Info size={11} /> {state.metadata?.irregularSampling ? "Irregular sampling" : `${state.metadata?.averageSampleRate.toFixed(1)} Hz`}</span></div>
    </main><ChannelBrowser onOpenRules={() => setRulesOpen(true)} onEditCalculated={(channelId) => openFormula(channelId)} /></div>
    <DiagnosticDetails />
    <WorkspaceSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenDiagnosticRules={() => { setSettingsOpen(false); setRulesOpen(true); }} onOpenChannelMappings={() => { setSettingsOpen(false); setMappingOpen(true); }} />
    <DiagnosticRulesManager open={rulesOpen} onClose={() => setRulesOpen(false)} onRerun={(profile) => void rerunDiagnostics(profile)} onOpenChannelMappings={() => { setRulesOpen(false); setMappingOpen(true); }} />
    <ChannelMappingManager open={mappingOpen} onClose={() => setMappingOpen(false)} onApply={async (overrides) => { const profile = state.diagnosticProfiles.find((item) => item.id === state.activeDiagnosticProfileId) ?? state.diagnosticProfiles[0]; if (profile) await rerunDiagnostics(profile, overrides); }} />
    {formulaOpen && <FormulaBuilder editingChannelId={formulaTargetId} onClose={() => { setFormulaOpen(false); setFormulaTargetId(null); }} />}{toast && <div className="toast" role="status" aria-live="polite" aria-atomic="true"><Save size={15} />{toast}</div>}
  </div>;
}

function SingleView() {
  const { selectedChannelIds, activeChannelId, channels, hiddenChannelIds, cursorIndex, valueDisplayMode, valuePrecision, setActiveChannel } = useWorkspaceStore();
  return <div className="single-view"><div className="view-heading"><div><span className="eyebrow">SINGLE CHART</span></div><span>Scroll to zoom · drag to select · double-click reset</span></div><TelemetryChart channelIds={selectedChannelIds} fillHeight title="SYNCHRONIZED TELEMETRY" />
    {valueDisplayMode === "panel" && <div className="legend-grid">{selectedChannelIds.map((id) => { const channel = channels.find((item) => item.id === id); if (!channel) return null; const value = cursorIndex === null ? undefined : datasetStore.getColumn(id)?.[cursorIndex]; return <button key={id} aria-pressed={activeChannelId === id} className={`${hiddenChannelIds.includes(id) ? "hidden-series" : ""} ${activeChannelId === id ? "active-series" : ""}`} onClick={() => setActiveChannel(id)}><i style={{ background: channel.color }} /><span><b>{channel.name}</b><small>{channel.unit}</small></span><strong>{formatChartValue(value, valuePrecision)}</strong><em><span>MIN {formatChartValue(channel.min, valuePrecision)}</span><span>MAX {formatChartValue(channel.max, valuePrecision)}</span></em></button>; })}</div>}</div>;
}

function SplitView() {
  const { panels, channels, addPanel, removePanel, togglePanel, moveChannelToPanel } = useWorkspaceStore();
  return <div className="split-view"><div className="view-heading"><div><span className="eyebrow">SYNCHRONIZED SPLIT</span></div><button className="button secondary small-button" onClick={addPanel}><Plus size={13} /> Add chart</button></div>
    {panels.map((panel, index) => <section className="split-panel" key={panel.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("channel/id"); if (id) moveChannelToPanel(id, panel.id); }}><header><div><span className="drag-handle" aria-hidden="true">⠿</span><b>{panel.title}</b><small>{panel.channelIds.map((id) => channels.find((channel) => channel.id === id)?.name).filter(Boolean).join(" · ") || "Drop a channel here"}</small></div><div><button aria-label={panel.collapsed ? `Expand ${panel.title}` : `Collapse ${panel.title}`} aria-expanded={!panel.collapsed} onClick={() => togglePanel(panel.id)}>{panel.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button><button aria-label={`View ${panel.title} fullscreen`} onClick={() => document.querySelector<HTMLElement>(`[data-panel='${panel.id}']`)?.requestFullscreen()}><Expand size={14} /></button><button aria-label={`Remove ${panel.title}`} onClick={() => removePanel(panel.id)} disabled={panels.length === 1}><Trash2 size={14} /></button></div></header>{!panel.collapsed && <div data-panel={panel.id}><TelemetryChart channelIds={panel.channelIds} height={panel.height} showXAxis={index === panels.length - 1} /></div>}</section>)}
  </div>;
}
