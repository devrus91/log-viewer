import { create } from "zustand";
import type { AxisMode, ChannelMetadata, ChartContrast, ChartLineThickness, ChartPanelConfig, ChartTextSize, CrosshairMode, CursorSampling, DiagnosticAnalysis, DiagnosticEvent, DiagnosticMarkerMode, DiagnosticProfile, DiagnosticSeverity, GridVisibility, HeatmapConfig, LogMetadata, SeriesDifferentiation, TooltipContents, TooltipPosition, ValuePrecision, ViewPreset, WheelZoomMode, WorkspaceMode } from "@/domain/types";

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
  tooltipPosition: TooltipPosition;
  nearestChannelFocusEnabled: boolean;
  chartTextSize: ChartTextSize;
  seriesDifferentiation: SeriesDifferentiation;
  chartLineThickness: ChartLineThickness;
  chartContrast: ChartContrast;
  crosshairMode: CrosshairMode;
  tooltipContents: TooltipContents;
  valuePrecision: ValuePrecision;
  cursorSampling: CursorSampling;
  gridVisibility: GridVisibility;
  wheelZoomMode: WheelZoomMode;
  diagnosticMarkerMode: DiagnosticMarkerMode;
  pinnedTooltipChannelIds: string[];
  setDataset: (metadata: LogMetadata, channels: ChannelMetadata[], diagnostics?: DiagnosticAnalysis) => void;
  closeDataset: () => void;
  addCalculatedChannel: (channel: ChannelMetadata) => void;
  updateCalculatedChannels: (channels: ChannelMetadata[], activeChannelId: string) => void;
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
  setTooltipPosition: (position: TooltipPosition) => void;
  setNearestChannelFocusEnabled: (enabled: boolean) => void;
  setChartTextSize: (size: ChartTextSize) => void;
  setSeriesDifferentiation: (mode: SeriesDifferentiation) => void;
  setChartLineThickness: (thickness: ChartLineThickness) => void;
  setChartContrast: (contrast: ChartContrast) => void;
  setCrosshairMode: (mode: CrosshairMode) => void;
  setTooltipContents: (contents: TooltipContents) => void;
  setValuePrecision: (precision: ValuePrecision) => void;
  setCursorSampling: (sampling: CursorSampling) => void;
  setGridVisibility: (visibility: GridVisibility) => void;
  setWheelZoomMode: (mode: WheelZoomMode) => void;
  setDiagnosticMarkerMode: (mode: DiagnosticMarkerMode) => void;
  toggleTooltipPinnedChannel: (id: string) => void;
  hydratePreferences: (storage: Storage) => void;
  resetChartPreferences: () => void;
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
  tooltipPosition: "auto",
  nearestChannelFocusEnabled: true,
  chartTextSize: "standard",
  seriesDifferentiation: "patterns",
  chartLineThickness: "standard",
  chartContrast: "system",
  crosshairMode: "vertical",
  tooltipContents: "all",
  valuePrecision: "auto",
  cursorSampling: "nearest",
  gridVisibility: "standard",
  wheelZoomMode: "always",
  diagnosticMarkerMode: "all",
  pinnedTooltipChannelIds: [],
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
      pinnedTooltipChannelIds: [],
      xChannelId: metadata.timeChannelId,
      range: significant ? [Math.max(0, significant.startIndex - padding), Math.min(metadata.rows - 1, significant.endIndex + padding)] : [0, Math.max(1, metadata.rows - 1)],
      cursorIndex: significant?.peakIndex ?? null,
      diagnostics: diagnostics ?? null,
      selectedDiagnosticId: null,
      panels: defaultPanels.map((panel, index) => ({ ...panel, channelIds: index === 0 ? selected.slice(0, 2) : index === 1 ? selected.slice(2, 3) : selected.slice(3, 4) })),
      heatmap: { ...defaultHeatmap, xChannelId: rpm, yChannelId: throttle, valueChannelId: boost },
    });
  },
  closeDataset: () => set({ metadata: null, channels: [], selectedChannelIds: [], activeChannelId: null, hiddenChannelIds: [], xChannelId: "", range: [0, 1], cursorIndex: null, diagnostics: null, selectedDiagnosticId: null }),
  addCalculatedChannel: (channel) => set((state) => {
    const existing = state.channels.find((item) => item.id === channel.id || (item.type === "calculated" && item.name.toLocaleLowerCase() === channel.name.toLocaleLowerCase()));
    const channels = existing ? state.channels.map((item) => item.id === existing.id ? channel : item) : [...state.channels, channel];
    const selectedChannelIds = Array.from(new Set([...state.selectedChannelIds.map((id) => id === existing?.id ? channel.id : id), channel.id]));
    return { channels, selectedChannelIds, activeChannelId: channel.id };
  }),
  updateCalculatedChannels: (updated, activeChannelId) => set((state) => {
    const replacements = new Map(updated.map((channel) => [channel.id, channel]));
    return { channels: state.channels.map((channel) => replacements.get(channel.id) ?? channel), activeChannelId };
  }),
  setMode: (mode) => set({ mode }),
  setAxisMode: (axisMode) => set({ axisMode }),
  toggleChannel: (id) => set((state) => {
    const removing = state.selectedChannelIds.includes(id);
    const selectedChannelIds = removing ? state.selectedChannelIds.filter((value) => value !== id) : [...state.selectedChannelIds, id];
    const activeChannelId = !state.nearestChannelFocusEnabled ? null : removing && state.activeChannelId === id ? selectedChannelIds[0] ?? null : removing ? state.activeChannelId : id;
    return { selectedChannelIds, activeChannelId, pinnedTooltipChannelIds: removing ? state.pinnedTooltipChannelIds.filter((value) => value !== id) : state.pinnedTooltipChannelIds };
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
    const selectedChannelIds = Array.from(new Set([...state.selectedChannelIds, ...related]));
    set({ mode: "single", selectedDiagnosticId: event.id, selectedChannelIds, activeChannelId: related[0] ?? state.activeChannelId, range: [Math.max(0, event.startIndex - padding), Math.min((state.metadata?.rows ?? 1) - 1, event.endIndex + padding)], cursorIndex: event.peakIndex });
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
  setTooltipPosition: (tooltipPosition) => {
    if (typeof window !== "undefined") window.localStorage.setItem("automotive-log-viewer.tooltip-position", tooltipPosition);
    set({ tooltipPosition });
  },
  setNearestChannelFocusEnabled: (nearestChannelFocusEnabled) => {
    if (typeof window !== "undefined") window.localStorage.setItem("automotive-log-viewer.nearest-channel-focus", String(nearestChannelFocusEnabled));
    set((state) => ({ nearestChannelFocusEnabled, activeChannelId: nearestChannelFocusEnabled ? state.activeChannelId : null }));
  },
  setChartTextSize: (chartTextSize) => persist(set, "chart-text-size", chartTextSize, { chartTextSize }),
  setSeriesDifferentiation: (seriesDifferentiation) => persist(set, "series-differentiation", seriesDifferentiation, { seriesDifferentiation }),
  setChartLineThickness: (chartLineThickness) => persist(set, "chart-line-thickness", chartLineThickness, { chartLineThickness }),
  setChartContrast: (chartContrast) => persist(set, "chart-contrast", chartContrast, { chartContrast }),
  setCrosshairMode: (crosshairMode) => persist(set, "crosshair-mode", crosshairMode, { crosshairMode }),
  setTooltipContents: (tooltipContents) => persist(set, "tooltip-contents", tooltipContents, { tooltipContents }),
  setValuePrecision: (valuePrecision) => persist(set, "value-precision", valuePrecision, { valuePrecision }),
  setCursorSampling: (cursorSampling) => persist(set, "cursor-sampling", cursorSampling, { cursorSampling }),
  setGridVisibility: (gridVisibility) => persist(set, "grid-visibility", gridVisibility, { gridVisibility }),
  setWheelZoomMode: (wheelZoomMode) => persist(set, "wheel-zoom-mode", wheelZoomMode, { wheelZoomMode }),
  setDiagnosticMarkerMode: (diagnosticMarkerMode) => persist(set, "diagnostic-marker-mode", diagnosticMarkerMode, { diagnosticMarkerMode }),
  toggleTooltipPinnedChannel: (id) => set((state) => ({ pinnedTooltipChannelIds: state.pinnedTooltipChannelIds.includes(id) ? state.pinnedTooltipChannelIds.filter((value) => value !== id) : [...state.pinnedTooltipChannelIds, id] })),
  hydratePreferences: (storage) => set((state) => {
    const nearestChannelFocusEnabled = storage.getItem("automotive-log-viewer.nearest-channel-focus") !== "false";
    return {
    diagnosticsEnabled: storage.getItem("automotive-log-viewer.diagnostics-enabled") !== "false",
    valueDisplayMode: oneOf(storage.getItem("automotive-log-viewer.value-display-mode"), ["panel", "tooltip"], "panel"),
    tooltipPosition: oneOf(storage.getItem("automotive-log-viewer.tooltip-position"), ["auto", "left", "right"], "auto"),
    nearestChannelFocusEnabled,
    activeChannelId: nearestChannelFocusEnabled ? state.activeChannelId : null,
    chartTextSize: oneOf(storage.getItem(preferenceKey("chart-text-size")), ["compact", "standard", "large"], "standard"),
    seriesDifferentiation: oneOf(storage.getItem(preferenceKey("series-differentiation")), ["color", "patterns"], "patterns"),
    chartLineThickness: oneOf(storage.getItem(preferenceKey("chart-line-thickness")), ["thin", "standard", "bold"], "standard"),
    chartContrast: oneOf(storage.getItem(preferenceKey("chart-contrast")), ["system", "standard", "high"], "system"),
    crosshairMode: oneOf(storage.getItem(preferenceKey("crosshair-mode")), ["vertical", "both", "off"], "vertical"),
    tooltipContents: oneOf(storage.getItem(preferenceKey("tooltip-contents")), ["all", "focused-pinned", "focused"], "all"),
    valuePrecision: oneOf(storage.getItem(preferenceKey("value-precision")), ["auto", "0", "1", "2", "3", "4"], "auto"),
    cursorSampling: oneOf(storage.getItem(preferenceKey("cursor-sampling")), ["nearest", "interpolated"], "nearest"),
    gridVisibility: oneOf(storage.getItem(preferenceKey("grid-visibility")), ["off", "subtle", "standard", "strong"], "standard"),
    wheelZoomMode: oneOf(storage.getItem(preferenceKey("wheel-zoom-mode")), ["always", "modifier", "disabled"], "always"),
    diagnosticMarkerMode: oneOf(storage.getItem(preferenceKey("diagnostic-marker-mode")), ["all", "warning-critical", "critical", "hidden"], "all"),
  }; }),
  resetChartPreferences: () => {
    const defaults: Partial<WorkspaceState> = { valueDisplayMode: "panel", chartTextSize: "standard", seriesDifferentiation: "patterns", chartLineThickness: "standard", chartContrast: "system", crosshairMode: "vertical", tooltipContents: "all", valuePrecision: "auto", cursorSampling: "nearest", gridVisibility: "standard", wheelZoomMode: "always", diagnosticMarkerMode: "all", tooltipPosition: "auto", nearestChannelFocusEnabled: true };
    if (typeof window !== "undefined") {
      window.localStorage.setItem("automotive-log-viewer.value-display-mode", "panel");
      window.localStorage.setItem("automotive-log-viewer.tooltip-position", "auto");
      window.localStorage.setItem("automotive-log-viewer.nearest-channel-focus", "true");
      Object.entries({ "chart-text-size": "standard", "series-differentiation": "patterns", "chart-line-thickness": "standard", "chart-contrast": "system", "crosshair-mode": "vertical", "tooltip-contents": "all", "value-precision": "auto", "cursor-sampling": "nearest", "grid-visibility": "standard", "wheel-zoom-mode": "always", "diagnostic-marker-mode": "all" }).forEach(([name, value]) => window.localStorage.setItem(preferenceKey(name), value));
    }
    set(defaults);
  },
  resetZoom: () => { const rows = get().metadata?.rows ?? 2; set({ range: [0, Math.max(1, rows - 1)] }); },
}));

function preferenceKey(name: string): string { return `automotive-log-viewer.${name}`; }

function persist(set: (partial: Partial<WorkspaceState>) => void, name: string, value: string, partial: Partial<WorkspaceState>): void {
  if (typeof window !== "undefined") window.localStorage.setItem(preferenceKey(name), value);
  set(partial);
}

function oneOf<const T extends string>(value: string | null, choices: readonly T[], fallback: T): T {
  return value !== null && choices.includes(value as T) ? value as T : fallback;
}
