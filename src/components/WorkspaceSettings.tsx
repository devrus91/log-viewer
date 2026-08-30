"use client";

import { Activity, RotateCcw, Settings2, X } from "lucide-react";
import { useWorkspaceStore } from "@/state/workspace-store";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenDiagnosticRules: () => void;
}

export function WorkspaceSettings({ open, onClose, onOpenDiagnosticRules }: Props) {
  const { axisMode, setAxisMode, resetZoom, diagnosticsEnabled, setDiagnosticsEnabled, valueDisplayMode, setValueDisplayMode, activeDiagnosticProfileId, diagnosticProfiles, selectedChannelIds } = useWorkspaceStore();
  if (!open) return null;
  const activeProfile = diagnosticProfiles.find((profile) => profile.id === activeDiagnosticProfileId);

  return <div className="modal-backdrop"><div className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-settings-title">
    <header><div><span className="eyebrow">WORKSPACE</span><h2 id="workspace-settings-title">Viewer Settings</h2><p>Chart behavior and diagnostic configuration for the current workspace.</p></div><button aria-label="Close settings" onClick={onClose}><X size={18} /></button></header>
    <div className="settings-body">
      <section><div className="settings-section-title"><Activity size={15} /><div><h3>Chart display</h3><p>Configure axes and how cursor values are presented.</p></div></div><h4>AXIS GROUPING</h4><div className="settings-options">{(["auto", "shared", "independent"] as const).map((mode) => <button key={mode} className={axisMode === mode ? "active" : ""} onClick={() => setAxisMode(mode)}><b>{mode}</b><span>{mode === "auto" ? "Group channels with matching units" : mode === "shared" ? "Use one scale for every channel" : "Give each channel its own scale"}</span></button>)}</div><h4>VALUES AT CURSOR</h4><div className="settings-options two">{(["panel", "tooltip"] as const).map((mode) => <button key={mode} className={valueDisplayMode === mode ? "active" : ""} onClick={() => setValueDisplayMode(mode)}><b>{mode === "panel" ? "Bottom panel" : "Chart tooltip"}</b><span>{mode === "panel" ? "Show every selected parameter below the graph" : "Show all selected parameter values in a compact cursor card"}</span></button>)}</div><button className="button secondary" onClick={resetZoom}><RotateCcw size={13} /> Reset chart zoom</button></section>
      <section><div className="settings-section-title"><Settings2 size={15} /><div><h3>Diagnostics</h3><p>Active profile: <b>{activeProfile?.name ?? "Default"}</b></p></div></div><label className="settings-switch"><span><b>Automatic diagnostics</b><small>Show log health, event markers and the Diagnostics tab.</small></span><input type="checkbox" checked={diagnosticsEnabled} onChange={(event) => setDiagnosticsEnabled(event.target.checked)} /></label><div className="settings-fact"><span>Visible parameters</span><b>{selectedChannelIds.length}</b></div><button className="button primary" onClick={onOpenDiagnosticRules}><Settings2 size={13} /> Configure diagnostic rules</button></section>
    </div>
    <footer><span>Log samples remain local to this browser.</span><button className="button primary" onClick={onClose}>Done</button></footer>
  </div></div>;
}
