"use client";

import { useRef, useState } from "react";
import { Activity, FileUp, LockKeyhole, Zap } from "lucide-react";
import { calculateFormulaInWorker, parseCsvInWorker } from "@/workers/client";
import { datasetStore } from "@/data/dataset-store";
import { materializeCalculatedChannels } from "@/data/calculated-channels";
import { loadCalculatedChannelDefinitions } from "@/persistence/calculated-channels";
import { useWorkspaceStore } from "@/state/workspace-store";
import { createDiagnosticRuleRepository, getActiveDiagnosticProfile } from "@/diagnostics/persistence/LocalStorageDiagnosticRuleRepository";

export function ImportScreen() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setDataset = useWorkspaceStore((state) => state.setDataset);
  const load = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Choose a .csv telemetry log"); return; }
    setLoading(true); setError("");
    try {
      const repository = createDiagnosticRuleRepository();
      const profile = getActiveDiagnosticProfile(repository);
      const dataset = await parseCsvInWorker(file, profile);
      const restored = await materializeCalculatedChannels(loadCalculatedChannelDefinitions(), dataset.channels, dataset.columns, dataset.metadata.rows, calculateFormulaInWorker);
      datasetStore.load(dataset);
      restored.forEach(({ channel, values }) => datasetStore.setColumn(channel, values));
      setDataset(dataset.metadata, [...dataset.channels, ...restored.map(({ channel }) => channel)], dataset.analysis);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not parse this log"); }
    finally { setLoading(false); }
  };
  const sample = () => {
    const lines = ["Time (s),Engine Speed (rpm),Boost Pressure Actual (bar),Boost Pressure Target (bar),Throttle Actual (%),Torque Request (Nm),Torque Actual (Nm),Lambda,Vehicle Speed (km/h),Wheel Speed RL (km/h),Engine Temperature (°C),Gear"];
    for (let index = 0; index < 4200; index += 1) {
      const time = index / 50; const pull = Math.max(0, Math.sin(index / 370)); const rpm = 1200 + (index % 900) * 7 * pull; const throttle = 18 + pull * 81; const target = .2 + pull * 2.4; const boost = target + Math.sin(index / 31) * .08; const speed = 22 + rpm / 95;
      lines.push([time, rpm, boost, target, throttle, 120 + pull * 540, 108 + pull * 510 + Math.sin(index / 43) * 15, .98 - pull * .16, speed, speed * (1 + pull * .018), 82 + Math.sin(index / 800) * 7, Math.min(6, Math.max(1, Math.floor(rpm / 1100)))].map((value) => Number(value).toFixed(3)).join(","));
    }
    void load(new File([lines.join("\n")], "sample_dyno_pull.csv", { type: "text/csv" }));
  };
  return <main className="import-screen"><nav className="brand" aria-label="Automotive Log Viewer"><div className="brand-mark"><Activity size={20} /></div><div><b>AUTOMOTIVE</b><span>LOG VIEWER</span></div></nav><section className="import-card"><div className="import-kicker"><span>LOCAL TELEMETRY WORKSPACE</span><i /></div><h1>Every channel.<br /><em>One clear signal.</em></h1><p>Inspect ECU logs with synchronized plots, calculated channels and high-density heatmaps — without uploading a single byte.</p>
    <label className={`dropzone ${dragging ? "dragging" : ""}`} aria-busy={loading} aria-describedby="csv-file-help" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void load(file); }}><div className="drop-icon"><FileUp size={26} /></div><b aria-live="polite">{loading ? "PARSING TELEMETRY…" : "CHOOSE OR DROP A CSV LOG"}</b><span id="csv-file-help">Comma, semicolon, and tab-delimited files are supported</span><input ref={inputRef} className="visually-hidden" type="file" accept=".csv,text/csv" disabled={loading} aria-label="Choose CSV telemetry log" onChange={(event) => { const file = event.target.files?.[0]; if (file) void load(file); }} /></label>
    {error && <div className="import-error" role="alert">{error}</div>}<button className="sample-button" onClick={sample} disabled={loading}><Zap size={14} /> Explore with a sample dyno pull</button>
    <div className="import-trust"><span><LockKeyhole size={14} /> Local-first privacy</span><span>Typed arrays</span><span>Worker processing</span></div></section><div className="import-grid" /></main>;
}
