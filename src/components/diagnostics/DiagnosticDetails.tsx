"use client";

import { Clock3, Gauge, Link2, X } from "lucide-react";
import { useWorkspaceStore } from "@/state/workspace-store";

export function DiagnosticDetails() {
  const { diagnostics, diagnosticsEnabled, selectedDiagnosticId, closeDiagnostic, focusDiagnostic } = useWorkspaceStore();
  const event = diagnostics?.events.find((item) => item.id === selectedDiagnosticId);
  if (!diagnosticsEnabled || !event) return null;
  const correlated = diagnostics?.events.filter((item) => event.correlatedEventIds.includes(item.id)) ?? [];
  return <aside className="diagnostic-details"><header><div><span className={`severity-badge ${event.severity}`}>{event.severity}</span><h2>{event.name}</h2></div><button aria-label="Close diagnostic details" onClick={closeDiagnostic}><X size={16} /></button></header><p>{event.message}</p>
    <div className="diagnostic-facts"><div><Clock3 size={14} /><span>Time</span><b>{event.startTime.toFixed(3)}–{event.endTime.toFixed(3)} s</b></div><div><Gauge size={14} /><span>Peak</span><b>{event.peakTime.toFixed(3)} s{event.peakRpm !== null ? ` · ${event.peakRpm.toFixed(0)} rpm` : ""}</b></div><div><span>Confidence</span><b>{event.confidence}</b></div><div><span>Occurrences</span><b>{event.occurrences}</b></div></div>
    {Object.keys(event.values).length > 0 && <section><h3>Measured context</h3><div className="event-values">{Object.entries(event.values).map(([key, value]) => <div key={key}><span>{splitKey(key)}</span><b>{typeof value === "number" ? format(value) : value}</b></div>)}</div></section>}
    {correlated.length > 0 && <section><h3><Link2 size={12} /> Correlated events</h3>{correlated.map((item) => <button className="correlated-event" key={item.id} onClick={() => focusDiagnostic(item)}><i className={`severity-dot ${item.severity}`} /><span>{item.name}</span><small>{Math.round((item.peakTime - event.peakTime) * 1000)} ms</small></button>)}</section>}
    {event.possibleCauses.length > 0 && <section><h3>Possible causes</h3><p className="hypothesis-note">Hypotheses only — not a confirmed mechanical diagnosis.</p><ul>{event.possibleCauses.map((cause) => <li key={cause}>{cause}</li>)}</ul></section>}
  </aside>;
}

function splitKey(value: string): string { return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()); }
function format(value: number): string { return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(3); }
