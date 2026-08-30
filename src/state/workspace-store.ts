import { create } from "zustand";
import type { AxisMode, ChannelMetadata, ChartPanelConfig, DiagnosticAnalysis, DiagnosticEvent, DiagnosticProfile, DiagnosticSeverity, HeatmapConfig, LogMetadata, ViewPreset, WorkspaceMode } from "@/domain/types";

const defaultHeatmap: HeatmapConfig = {
  xChannelId: "",
  yChannelId: "",
  valueChannelId: "",
  xBins: 20,
  yBins: 14,
  aggregation: "average",
  minSamples: 1,
  filters: [],
};

const defaultPanels: ChartPanelConfig[] = [
  { id: "panel-1", title: "POWERTRAIN", channelIds: [], height: 230, collapsed: false },
  { id: "panel-2", title: "AIR & BOOST", channelIds: [], height: 210, collapsed: false },
  { id: "panel-3", title: "FUEL & TIMING", channelIds: [], height: 210, collapsed: false },
];

interface WorkspaceState {
  metadata: LogMetadata | null;
  channels: ChannelMetadata[];
  mode: WorkspaceMode;
  axisMode: AxisMode;
  selectedChannelIds: string[];
  activeChannelId: string | null;
  hiddenChannelIds: string[];
  xChannelId: string;
  panels: ChartPanelConfig[];
  range: [number, number];
  cursorIndex: number | null;
  heatmap: HeatmapConfig;
  presets: ViewPreset[];
  sidebarTab: "channels" | "diagnostics" | "presets" | "info";
  diagnostics: DiagnosticAnalysis | null;
  diagnosticFilter: DiagnosticSeverity | "all";
  selectedDiagnosticId: string | null;
  diagnosticProfiles: DiagnosticProfile[];
  activeDiagnosticProfileId: string;
  diagnosticsRunning: boolean;
  diagnosticsEnabled: boolean;
  valueDisplayMode: "panel" | "tooltip";
  setDataset: (metadata: LogMetadata, channels: ChannelMetadata[], diagnostics?: DiagnosticAnalysis) => void;
  addCalculatedChannel: (channel: ChannelMetadata) => void;
  setMode: (mode: WorkspaceMode) => void;
  setAxisMode: (mode: AxisMode) => void;
  toggleChannel: (id: string) => void;
  setActiveChannel: (id: string | null) => void;
  toggleHidden: (id: string) => void;
  setXChannel: (id: string) => void;
  setRange: (range: [number, number]) => void;
  setCursorIndex: (index: number | null) => void;
  setHeatmap: (patch: Partial<HeatmapConfig>) => void;
  addPanel: () => void;
  removePanel: (id: string) => void;
  togglePanel: (id: string) => void;
  moveChannelToPanel: (channelId: string, panelId: string) => void;
  setPresets: (presets: ViewPreset[]) => void;
  applyPreset: (preset: ViewPreset) => void;
  setSidebarTab: (tab: "channels" | "diagnostics" | "presets" | "info") => void;
  setDiagnostics: (analysis: DiagnosticAnalysis) => void;
  setDiagnosticFilter: (filter: DiagnosticSeverity | "all") => void;
  focusDiagnostic: (event: DiagnosticEvent) => void;
  closeDiagnostic: () => void;
  setDiagnosticProfiles: (profiles: DiagnosticProfile[], activeId: string) => void;
  setActiveDiagnosticProfileId: (id: string) => void;
  setDiagnosticsRunning: (running: boolean) => void;
  setDiagnosticsEnabled: (enabled: boolean) => void;
  setValueDisplayMode: (mode: "panel" | "tooltip") => void;
  resetZoom: () => void;
}

function autoSelect(channels: ChannelMetadata[]): string[] {
  const aliases = [/engine speed|rpm/i, /boost.*(actual|pressure)|boost pressure/i, /throttle.*actual|accelerator pedal/i, /lambda|afr/i];
  return aliases.map((alias) => channels.find((channel) => alias.test(channel.name))?.id).filter((id): id is string => Boolean(id)).slice(0, 4);
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  metadata: null,
  channels: [],
  mode: "single",
  axisMode: "auto",
  selectedChannelIds: [],
  activeChannelId: null,
  hiddenChannelIds: [],
  xChannelId: "",
  panels: defaultPanels,
  range: [0, 1],
  cursorIndex: null,
  heatmap: defaultHeatmap,
  presets: [],
  sidebarTab: "channels",
  diagnostics: null,
  diagnosticFilter: "all",
  selectedDiagnosticId: null,
  diagnosticProfiles: [],
  activeDiagnosticProfileId: "default",
  diagnosticsRunning: false,
  diagnosticsEnabled: true,
  valueDisplayMode: "panel",
  setDataset: (metadata, channels, diagnostics) => {
    const selected = autoSelect(channels);
    const rpm = channels.find((channel) => /engine speed|rpm/i.test(channel.name))?.id ?? channels[0]?.id ?? "";
    const throttle = channels.find((channel) => /throttle/i.test(channel.name))?.id ?? channels[1]?.id ?? rpm;
    const boost = channels.find((channel) => /boost.*(actual|pressure)|boost pressure/i.test(channel.name))?.id ?? channels[2]?.id ?? rpm;
    const significant = diagnostics?.events.find((event) => event.severity === "critical") ?? diagnostics?.events.find((event) => event.severity === "warning") ?? diagnostics?.events[0];
    const padding = Math.max(1, Math.round(metadata.averageSampleRate * 2));
    const diagnosticSelection = significant?.relatedChannels.filter((id) => channels.some((channel) => channel.id === id)).slice(0, 7) ?? [];
    const selectedChannelIds = diagnosticSelection.length ? Array.from(new Set([rpm, ...diagnosticSelection])) : selected.length ? selected : channels.slice(0, 3).map((channel) => channel.id);
    set({
      metadata,
      channels,
      selectedChannelIds,
      activeChannelId: selectedChannelIds[0] ?? null,
      hiddenChannelIds: [],
      xChannelId: metadata.timeChannelId,
      range: significant ? [Math.max(0, significant.startIndex - padding), Math.min(metadata.rows - 1, significant.endIndex + padding)] : [0, Math.max(1, metadata.rows - 1)],
      cursorIndex: significant?.peakIndex ?? null,
      diagnostics: diagnostics ?? null,
      selectedDiagnosticId: null,
      panels: defaultPanels.map((panel, index) => ({ ...panel, channelIds: index === 0 ? selected.slice(0, 2) : index === 1 ? selected.slice(2, 3) : selected.slice(3, 4) })),
      heatmap: { ...defaultHeatmap, xChannelId: rpm, yChannelId: throttle, valueChannelId: boost },
    });
  },
  addCalculatedChannel: (channel) => set((state) => ({ channels: [...state.channels, channel], selectedChannelIds: [...state.selectedChannelIds, channel.id], activeChannelId: channel.id })),
  setMode: (mode) => set({ mode }),
  setAxisMode: (axisMode) => set({ axisMode }),
  toggleChannel: (id) => set((state) => {
    const removing = state.selectedChannelIds.includes(id);
    const selectedChannelIds = removing ? state.selectedChannelIds.filter((value) => value !== id) : [...state.selectedChannelIds, id];
    return { selectedChannelIds, activeChannelId: removing && state.activeChannelId === id ? selectedChannelIds[0] ?? null : removing ? state.activeChannelId : id };
  }),
  setActiveChannel: (activeChannelId) => set({ activeChannelId }),
  toggleHidden: (id) => set((state) => ({ hiddenChannelIds: state.hiddenChannelIds.includes(id) ? state.hiddenChannelIds.filter((value) => value !== id) : [...state.hiddenChannelIds, id] })),
  setXChannel: (xChannelId) => set({ xChannelId }),
  setRange: (range) => set({ range }),
  setCursorIndex: (cursorIndex) => set({ cursorIndex }),
  setHeatmap: (patch) => set((state) => ({ heatmap: { ...state.heatmap, ...patch } })),
  addPanel: () => set((state) => ({ panels: [...state.panels, { id: `panel-${Date.now()}`, title: `CHART ${state.panels.length + 1}`, channelIds: [], height: 210, collapsed: false }] })),
  removePanel: (id) => set((state) => ({ panels: state.panels.filter((panel) => panel.id !== id) })),
  togglePanel: (id) => set((state) => ({ panels: state.panels.map((panel) => panel.id === id ? { ...panel, collapsed: !panel.collapsed } : panel) })),
  moveChannelToPanel: (channelId, panelId) => set((state) => ({ panels: state.panels.map((panel) => ({ ...panel, channelIds: panel.id === panelId ? Array.from(new Set([...panel.channelIds, channelId])) : panel.channelIds.filter((id) => id !== channelId) })) })),
  setPresets: (presets) => set({ presets }),
  applyPreset: (preset) => set({ mode: preset.mode, selectedChannelIds: preset.selectedChannelIds, activeChannelId: preset.selectedChannelIds[0] ?? null, panels: preset.panels, xChannelId: preset.xChannelId, range: preset.range, axisMode: preset.axisMode, heatmap: preset.heatmap }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  setDiagnostics: (diagnostics) => set({ diagnostics, diagnosticsRunning: false }),
  setDiagnosticFilter: (diagnosticFilter) => set({ diagnosticFilter }),
  focusDiagnostic: (event) => {
    const state = get(); const padding = Math.max(1, Math.round((state.metadata?.averageSampleRate ?? 10) * 2)); const related = event.relatedChannels.filter((id) => state.channels.some((channel) => channel.id === id));
    const selectedChannelIds = related.length ? related : state.selectedChannelIds;
    set({ mode: "single", selectedDiagnosticId: event.id, selectedChannelIds, activeChannelId: selectedChannelIds[0] ?? state.activeChannelId, range: [Math.max(0, event.startIndex - padding), Math.min((state.metadata?.rows ?? 1) - 1, event.endIndex + padding)], cursorIndex: event.peakIndex });
  },
  closeDiagnostic: () => set({ selectedDiagnosticId: null }),
  setDiagnosticProfiles: (diagnosticProfiles, activeDiagnosticProfileId) => set({ diagnosticProfiles, activeDiagnosticProfileId }),
  setActiveDiagnosticProfileId: (activeDiagnosticProfileId) => set({ activeDiagnosticProfileId }),
  setDiagnosticsRunning: (diagnosticsRunning) => set({ diagnosticsRunning }),
  setDiagnosticsEnabled: (diagnosticsEnabled) => {
    if (typeof window !== "undefined") window.localStorage.setItem("automotive-log-viewer.diagnostics-enabled", String(diagnosticsEnabled));
    set((state) => ({ diagnosticsEnabled, sidebarTab: !diagnosticsEnabled && state.sidebarTab === "diagnostics" ? "channels" : state.sidebarTab, selectedDiagnosticId: diagnosticsEnabled ? state.selectedDiagnosticId : null }));
  },
  setValueDisplayMode: (valueDisplayMode) => {
    if (typeof window !== "undefined") window.localStorage.setItem("automotive-log-viewer.value-display-mode", valueDisplayMode);
    set({ valueDisplayMode });
  },
  resetZoom: () => { const rows = get().metadata?.rows ?? 2; set({ range: [0, Math.max(1, rows - 1)] }); },
}));
