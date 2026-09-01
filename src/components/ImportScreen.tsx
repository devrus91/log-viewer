"use client";

import { useRef, useState } from "react";
import { Activity, FileUp, LockKeyhole, ShieldCheck, Sigma, Zap } from "lucide-react";
import { calculateFormulaInWorker, parseCsvInWorker } from "@/workers/client";
import { datasetStore } from "@/data/dataset-store";
import { materializeCalculatedChannels } from "@/data/calculated-channels";
import { loadCalculatedChannelDefinitions } from "@/persistence/calculated-channels";
import { useWorkspaceStore } from "@/state/workspace-store";
import { createDiagnosticRuleRepository, getActiveDiagnosticProfile } from "@/diagnostics/persistence/LocalStorageDiagnosticRuleRepository";
import { WotLabBrand } from "@/components/WotLabBrand";

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
  return <main className="import-screen"><nav className="brand" aria-label="WOT Lab home"><WotLabBrand /></nav><section className="import-card"><div className="import-kicker"><span>WORKSHOP-GRADE TELEMETRY</span><i /></div><h1>Every pull<br />tells a <em>story.</em></h1><p>Automotive log analysis, without the guesswork.</p><div className="import-capabilities" aria-label="Core capabilities"><span><Activity size={16} /><b>Synchronized</b><small>channels</small></span><span><Sigma size={16} /><b>Calculated</b><small>signals</small></span><span><ShieldCheck size={16} /><b>On-device</b><small>diagnostics</small></span></div>
    <label className={`dropzone ${dragging ? "dragging" : ""}`} aria-busy={loading} aria-describedby="csv-file-help" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void load(file); }}><div className="drop-icon"><FileUp size={26} /></div><b aria-live="polite">{loading ? "PARSING TELEMETRY…" : "CHOOSE OR DROP A CSV LOG"}</b><span id="csv-file-help">Comma, semicolon, and tab-delimited files are supported</span><input ref={inputRef} className="visually-hidden" type="file" accept=".csv,text/csv" disabled={loading} aria-label="Choose CSV telemetry log" onChange={(event) => { const file = event.target.files?.[0]; if (file) void load(file); }} /></label>
    {error && <div className="import-error" role="alert">{error}</div>}<button className="sample-button" onClick={sample} disabled={loading}><Zap size={14} /> Explore with a sample dyno pull</button>
    <div className="import-trust"><span><LockKeyhole size={14} /> Your log stays local</span><span>Fast worker processing</span><span>Built for dense ECU data</span></div></section><div className="import-grid" /><div className="import-trace" aria-hidden="true"><svg viewBox="0 0 1440 220" preserveAspectRatio="none"><path d="M0 167h122l19-8 17 9 18-82 17 101 21-39 20 19h158l18-5 15 5 12-105 20 132 23-46 18 19h188l17-7 19 7 17-133 18 164 22-56 17 25h218l19-4 15 4 17-76 20 92 22-33 18 17h185" /><path d="M0 190h286l20-22 20 23 18-47 19 48h287l18-18 17 17 21-67 19 69h329l17-27 19 25 19-46 18 47h318" /></svg></div></main>;
}
