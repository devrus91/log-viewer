"use client";

import { useState, type KeyboardEvent } from "react";
import { Activity, Crosshair, Link2, MousePointer2, RotateCcw, Settings2, X } from "lucide-react";
import { useWorkspaceStore } from "@/state/workspace-store";
import { AccessibleDialog } from "@/components/AccessibleDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenDiagnosticRules: () => void;
  onOpenChannelMappings: () => void;
}

type SettingsTab = "display" | "cursor" | "interaction" | "diagnostics";
const TABS: Array<{ id: SettingsTab; label: string; icon: typeof Activity }> = [
  { id: "display", label: "Display", icon: Activity },
  { id: "cursor", label: "Cursor & tooltip", icon: Crosshair },
  { id: "interaction", label: "Interaction", icon: MousePointer2 },
  { id: "diagnostics", label: "Diagnostics", icon: Settings2 },
];

interface SettingOption<T extends string> { value: T; label: string; description: string; disabled?: boolean; }

function SettingOptions<T extends string>({ legend, value, options, onChange, columns = 3 }: { legend: string; value: T; options: Array<SettingOption<T>>; onChange: (value: T) => void; columns?: 2 | 3 }) {
  return <fieldset className="settings-group"><legend>{legend}</legend><div className={`settings-options ${columns === 2 ? "two" : ""}`}>{options.map((option) => <button type="button" key={option.value} disabled={option.disabled} aria-pressed={value === option.value} className={value === option.value ? "active" : ""} onClick={() => onChange(option.value)}><b>{option.label}</b><span>{option.description}</span></button>)}</div></fieldset>;
}

export function WorkspaceSettings({ open, onClose, onOpenDiagnosticRules, onOpenChannelMappings }: Props) {
  const [tab, setTab] = useState<SettingsTab>("display");
  const state = useWorkspaceStore();
  if (!open) return null;
  const activeProfile = state.diagnosticProfiles.find((profile) => profile.id === state.activeDiagnosticProfileId);
  const selectAdjacentTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextIndex = (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[nextIndex].id);
    document.getElementById(`settings-tab-${TABS[nextIndex].id}`)?.focus();
  };

  return <AccessibleDialog className="settings-modal" ariaLabelledBy="workspace-settings-title" onClose={onClose}>
    <header><div><span className="eyebrow">WORKSPACE</span><h2 id="workspace-settings-title">Viewer Settings</h2><p>Chart presentation, interaction, and diagnostics preferences.</p></div><button aria-label="Close settings" onClick={onClose}><X size={18} /></button></header>
    <div className="settings-tabs" role="tablist" aria-label="Settings sections">{TABS.map(({ id, label, icon: Icon }, index) => <button id={`settings-tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`settings-panel-${id}`} tabIndex={tab === id ? 0 : -1} className={tab === id ? "active" : ""} key={id} onKeyDown={(event) => selectAdjacentTab(event, index)} onClick={() => setTab(id)}><Icon size={13} />{label}</button>)}</div>
    <div className="settings-tab-content">
      {tab === "display" && <section id="settings-panel-display" role="tabpanel" aria-labelledby="settings-tab-display">
        <div className="settings-section-title"><Activity size={15} /><div><h3>Display and readability</h3><p>Adjust chart density while preserving clear series identification.</p></div></div>
        <SettingOptions legend="Axis grouping" value={state.axisMode} onChange={state.setAxisMode} options={[{ value: "auto", label: "Auto", description: "Group matching units" }, { value: "shared", label: "Shared", description: "One scale for all" }, { value: "independent", label: "Independent", description: "A scale per channel" }]} />
        <SettingOptions legend="Chart text size" value={state.chartTextSize} onChange={state.setChartTextSize} options={[{ value: "compact", label: "Compact", description: "More plot area" }, { value: "standard", label: "Standard", description: "Balanced readability" }, { value: "large", label: "Large", description: "Maximum legibility" }]} />
        <SettingOptions legend="Series differentiation" value={state.seriesDifferentiation} onChange={state.setSeriesDifferentiation} columns={2} options={[{ value: "patterns", label: "Color + patterns", description: "Use solid, dashed, and dotted lines" }, { value: "color", label: "Color only", description: "Use solid colored lines" }]} />
        <SettingOptions legend="Line thickness" value={state.chartLineThickness} onChange={state.setChartLineThickness} options={[{ value: "thin", label: "Thin", description: "1.25 px" }, { value: "standard", label: "Standard", description: "1.75 px" }, { value: "bold", label: "Bold", description: "2.5 px" }]} />
        <SettingOptions legend="Chart contrast" value={state.chartContrast} onChange={state.setChartContrast} options={[{ value: "system", label: "Follow system", description: "Respect contrast preference" }, { value: "standard", label: "Standard", description: "Normal chart contrast" }, { value: "high", label: "High", description: "Stronger axes and grid" }]} />
        <SettingOptions legend="Grid visibility" value={state.gridVisibility} onChange={state.setGridVisibility} options={[{ value: "off", label: "Off", description: "No grid lines" }, { value: "subtle", label: "Subtle", description: "Low emphasis" }, { value: "standard", label: "Standard", description: "Balanced grid" }, { value: "strong", label: "Strong", description: "Maximum separation" }]} />
      </section>}

      {tab === "cursor" && <section id="settings-panel-cursor" role="tabpanel" aria-labelledby="settings-tab-cursor">
        <div className="settings-section-title"><Crosshair size={15} /><div><h3>Cursor and tooltip</h3><p>Control focus, sampling, precision, and value-card density.</p></div></div>
        <label className="settings-switch"><span><b>Focus nearest channel</b><small>Emphasize the closest series and fade the others.</small></span><input type="checkbox" checked={state.nearestChannelFocusEnabled} onChange={(event) => state.setNearestChannelFocusEnabled(event.target.checked)} /></label>
        <SettingOptions legend="Values at cursor" value={state.valueDisplayMode} onChange={state.setValueDisplayMode} columns={2} options={[{ value: "panel", label: "Bottom panel", description: "Persistent values below the graph" }, { value: "tooltip", label: "Chart tooltip", description: "Values beside the cursor" }]} />
        {state.valueDisplayMode === "tooltip" && <>
          <SettingOptions legend="Tooltip position" value={state.tooltipPosition} onChange={state.setTooltipPosition} options={[{ value: "auto", label: "Auto", description: "Prefer left, switch at edges" }, { value: "left", label: "Prefer left", description: "Use left when it fits" }, { value: "right", label: "Prefer right", description: "Use right when it fits" }]} />
          <SettingOptions legend="Tooltip contents" value={state.tooltipContents} onChange={state.setTooltipContents} options={[{ value: "all", label: "All visible", description: "Show every visible channel" }, { value: "focused-pinned", label: "Focused + pinned", description: "Use sidebar pins", disabled: !state.nearestChannelFocusEnabled }, { value: "focused", label: "Focused only", description: "Show nearest channel", disabled: !state.nearestChannelFocusEnabled }]} />
          <SettingOptions legend="Cursor sampling" value={state.cursorSampling} onChange={state.setCursorSampling} columns={2} options={[{ value: "nearest", label: "Nearest sample", description: "Show recorded values" }, { value: "interpolated", label: "Interpolated", description: "Estimate between samples" }]} />
        </>}
        <SettingOptions legend="Value precision" value={state.valuePrecision} onChange={state.setValuePrecision} options={(["auto", "0", "1", "2", "3", "4"] as const).map((value) => ({ value, label: value === "auto" ? "Auto" : `${value} decimals`, description: value === "auto" ? "Adapt to magnitude" : `Always show ${value}` }))} />
      </section>}

      {tab === "interaction" && <section id="settings-panel-interaction" role="tabpanel" aria-labelledby="settings-tab-interaction">
        <div className="settings-section-title"><MousePointer2 size={15} /><div><h3>Chart interaction</h3><p>Choose pointer guides and how the chart responds to scrolling.</p></div></div>
        <SettingOptions legend="Crosshair" value={state.crosshairMode} onChange={state.setCrosshairMode} options={[{ value: "vertical", label: "Vertical", description: "Track the X position" }, { value: "both", label: "Both axes", description: "Show X and Y guides" }, { value: "off", label: "Off", description: "Hide cursor guides" }]} />
        <SettingOptions legend="Mouse-wheel zoom" value={state.wheelZoomMode} onChange={state.setWheelZoomMode} options={[{ value: "always", label: "Always", description: "Wheel zooms the chart" }, { value: "modifier", label: "Ctrl/⌘ + wheel", description: "Prevent accidental zoom" }, { value: "disabled", label: "Disabled", description: "Use drag selection only" }]} />
        <div className="settings-actions"><button className="button secondary" onClick={state.resetZoom}><RotateCcw size={13} /> Reset chart zoom</button><button className="button secondary" onClick={state.resetChartPreferences}><RotateCcw size={13} /> Reset chart preferences</button></div>
        <p className="settings-help">Keyboard: focus the chart, then use Left/Right Arrow to step through samples or Home/End to jump across the visible range.</p>
      </section>}

      {tab === "diagnostics" && <section id="settings-panel-diagnostics" role="tabpanel" aria-labelledby="settings-tab-diagnostics">
        <div className="settings-section-title"><Settings2 size={15} /><div><h3>Diagnostics</h3><p>Active profile: <b>{activeProfile?.name ?? "Default"}</b></p></div></div>
        <label className="settings-switch"><span><b>Automatic diagnostics</b><small>Show log health, event markers, and the Diagnostics tab.</small></span><input type="checkbox" checked={state.diagnosticsEnabled} onChange={(event) => state.setDiagnosticsEnabled(event.target.checked)} /></label>
        <SettingOptions legend="Diagnostic markers" value={state.diagnosticMarkerMode} onChange={state.setDiagnosticMarkerMode} options={[{ value: "all", label: "All", description: "Info, warning, critical" }, { value: "warning-critical", label: "Warnings + critical", description: "Hide informational events" }, { value: "critical", label: "Critical only", description: "Show highest severity" }, { value: "hidden", label: "Hidden", description: "Keep chart clear" }]} />
        <div className="settings-fact"><span>Visible parameters</span><b>{state.selectedChannelIds.length}</b></div>
        <div className="settings-actions"><button className="button primary" onClick={onOpenDiagnosticRules}><Settings2 size={13} /> Configure diagnostic rules</button><button className="button secondary" onClick={onOpenChannelMappings}><Link2 size={13} /> Map channels</button></div>
      </section>}
    </div>
    <footer><span>Preferences are saved in this browser.</span><button className="button primary" onClick={onClose}>Done</button></footer>
  </AccessibleDialog>;
}
