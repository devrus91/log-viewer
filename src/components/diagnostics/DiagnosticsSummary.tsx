"use client";

import { Activity, AlertTriangle, ChevronRight, ShieldCheck } from "lucide-react";
import { useWorkspaceStore } from "@/state/workspace-store";
import type { DiagnosticSeverity } from "@/domain/types";

const severityOrder: Record<DiagnosticSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function DiagnosticsSummary() {
  const { diagnostics, diagnosticsRunning, diagnosticsEnabled, focusDiagnostic, setSidebarTab } = useWorkspaceStore();
  if (!diagnosticsEnabled || !diagnostics && !diagnosticsRunning) return null;
  const events = [...(diagnostics?.events ?? [])].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.peakTime - b.peakTime).slice(0, 4);
  return <section className="diagnostics-summary">
    <button className="health-overview" onClick={() => setSidebarTab("diagnostics")}><div className={`health-icon ${diagnostics?.health ?? "processing"}`}>{diagnosticsRunning ? <Activity size={17} /> : diagnostics?.counts.critical ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}</div><div><span>LOG HEALTH</span><b>{diagnosticsRunning ? "Analyzing…" : healthLabel(diagnostics?.health)}</b></div>{diagnostics && <small>{diagnostics.score}<i>/100</i></small>}</button>
    <div className="health-counts"><Count severity="critical" value={diagnostics?.counts.critical ?? 0} /><Count severity="warning" value={diagnostics?.counts.warning ?? 0} /><Count severity="info" value={diagnostics?.counts.info ?? 0} /></div>
    <div className="summary-events">{events.length ? events.map((event) => <button key={event.id} onClick={() => focusDiagnostic(event)}><i className={`severity-dot ${event.severity}`} /><span><b>{event.name}</b><small>{event.peakTime.toFixed(2)} s{event.peakRpm !== null ? ` · ${event.peakRpm.toFixed(0)} rpm` : ""}</small></span><ChevronRight size={13} /></button>) : <span className="no-findings">No configured patterns detected</span>}</div>
  </section>;
}

function Count({ severity, value }: { severity: DiagnosticSeverity; value: number }) { return <div className={severity}><i /> <b>{value}</b><span>{severity}</span></div>; }
function healthLabel(health: string | undefined): string { if (health === "critical-events") return "Critical events"; if (health === "attention-required") return "Attention required"; if (health === "minor-warnings") return "Minor warnings"; return "Healthy log"; }
