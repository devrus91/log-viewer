"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Plus, X, XCircle } from "lucide-react";
import { datasetStore } from "@/data/dataset-store";
import { collectDependencies, collectParameters, parseFormula } from "@/domain/formula";
import { safeId } from "@/data/csv";
import { saveCalculatedChannelDefinition } from "@/persistence/calculated-channels";
import { calculateFormulaInWorker } from "@/workers/client";
import { useWorkspaceStore } from "@/state/workspace-store";
import type { ChannelMetadata } from "@/domain/types";

interface FormulaBuilderProps { open: boolean; onClose: () => void; }

export function FormulaBuilder({ open, onClose }: FormulaBuilderProps) {
  const { channels, metadata, addCalculatedChannel } = useWorkspaceStore();
  const [name, setName] = useState("Boost Error");
  const [unit, setUnit] = useState("bar");
  const [expression, setExpression] = useState("");
  const [parameters, setParameters] = useState<Array<{ name: string; value: number }>>([]);
  const [saving, setSaving] = useState(false);
  const validation = useMemo(() => {
    if (!expression.trim()) return { valid: false, message: "Enter a formula" };
    try {
      const ast = parseFormula(expression);
      const dependencies = Array.from(collectDependencies(ast));
      const missing = dependencies.find((dependency) => !channels.some((channel) => channel.name === dependency));
      if (missing) return { valid: false, message: `Unknown channel “${missing}”` };
      if (parameters.some((parameter) => !parameter.name.trim())) return { valid: false, message: "Parameter names cannot be empty" };
      if (parameters.some((parameter) => !Number.isFinite(parameter.value))) return { valid: false, message: "Parameter values must be numbers" };
      const parameterNames = parameters.map((parameter) => parameter.name.trim()).filter(Boolean);
      if (new Set(parameterNames).size !== parameterNames.length) return { valid: false, message: "Parameter names must be unique" };
      const missingParameter = Array.from(collectParameters(ast)).find((parameter) => !parameterNames.includes(parameter));
      if (missingParameter) return { valid: false, message: `Missing parameter “${missingParameter}”` };
      return { valid: true, message: `${dependencies.length} dependencies resolved` };
    } catch (error) { return { valid: false, message: error instanceof Error ? error.message : "Invalid formula" }; }
  }, [expression, channels, parameters]);

  if (!open) return null;
  const insert = (value: string) => setExpression((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${value}`);
  const save = async () => {
    if (!validation.valid || !metadata || !name.trim()) return;
    setSaving(true);
    try {
      const namedColumns: Record<string, Float64Array> = {};
      channels.forEach((channel) => { const values = datasetStore.getColumn(channel.id); if (values) namedColumns[channel.name] = values; });
      const parameterValues = Object.fromEntries(parameters.map((parameter) => [parameter.name.trim(), parameter.value]));
      const values = await calculateFormulaInWorker(expression, namedColumns, parameterValues, metadata.rows);
      let min = Infinity; let max = -Infinity; let sum = 0; let count = 0;
      for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); sum += value; count += 1; }
      const definition = saveCalculatedChannelDefinition({ id: `calc-${safeId(name, channels.length)}`, name: name.trim(), unit: unit.trim() || "—", expression: expression.trim(), parameters: parameterValues, color: "#f472b6", createdAt: Date.now() });
      const channel: ChannelMetadata = { id: definition.id, name: definition.name, originalName: definition.name, unit: definition.unit, group: "Calculated", type: "calculated", min, max, average: count ? sum / count : Number.NaN, sampleCount: count, color: definition.color, expression: definition.expression };
      datasetStore.setColumn(channel, values);
      addCalculatedChannel(channel);
      onClose();
    } finally { setSaving(false); }
  };
  const previewDependencies = validation.valid ? Array.from(collectDependencies(parseFormula(expression))) : [];
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="formula-modal" role="dialog" aria-modal="true" aria-label="Formula Builder">
    <header><div><span className="eyebrow">CALCULATED CHANNEL</span><h2>Formula Builder</h2><p>Create a safe, reusable signal from original samples.</p></div><button aria-label="Close formula builder" onClick={onClose}><X size={18} /></button></header>
    <div className="formula-body"><section className="formula-editor">
      <div className="control-grid"><label className="field"><span>Channel name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field"><span>Unit</span><input value={unit} onChange={(event) => setUnit(event.target.value)} /></label></div>
      <label className="field"><span>Expression</span><textarea value={expression} onChange={(event) => setExpression(event.target.value)} placeholder="[Boost Pressure Actual (bar)] - [Boost Pressure Target (bar)]" spellCheck={false} /></label>
      <div className="operator-palette">{["+", "−", "×", "/", "%", "^", "(", ")", ">", "<=", "AND", "OR", "abs()", "max()", "clamp()", "if()"].map((operator) => <button key={operator} onClick={() => insert(operator.replace("−", "-").replace("×", "*").replace("()", "("))}>{operator}</button>)}</div>
      <div className={`validation ${validation.valid ? "valid" : "invalid"}`}>{validation.valid ? <CheckCircle2 size={16} /> : <XCircle size={16} />}<div><b>{validation.valid ? "Formula valid" : "Formula error"}</b><span>{validation.message}</span></div></div>
      <div className="parameters-head"><h3>Reusable parameters</h3><button onClick={() => setParameters((values) => [...values, { name: `PARAM_${values.length + 1}`, value: 1 }])}><Plus size={14} /> Add parameter</button></div>
      {parameters.map((parameter, index) => <div className="parameter-row" key={index}><input value={parameter.name} onChange={(event) => setParameters((values) => values.map((value, item) => item === index ? { ...value, name: event.target.value.toUpperCase() } : value))} /><span>=</span><input type="number" value={parameter.value} onChange={(event) => setParameters((values) => values.map((value, item) => item === index ? { ...value, value: Number(event.target.value) } : value))} /><button onClick={() => setParameters((values) => values.filter((_, item) => item !== index))}><X size={14} /></button></div>)}
      <div className="formula-preview"><div><span>PREVIEW</span><small>First 4 original samples</small></div><table><thead><tr>{previewDependencies.slice(0, 2).map((dependency) => <th key={dependency}>{dependency}</th>)}<th>{name || "Calculated"}</th></tr></thead><tbody>{[0, 1, 2, 3].map((row) => <tr key={row}>{previewDependencies.slice(0, 2).map((dependency) => <td key={dependency}>{format(channels.find((channel) => channel.name === dependency)?.id, row)}</td>)}<td className="preview-pending">{validation.valid ? "ready" : "—"}</td></tr>)}</tbody></table></div>
    </section><aside className="formula-channels"><div className="section-kicker"><span>CHANNELS</span><span>CLICK TO INSERT</span></div>{channels.map((channel) => <button key={channel.id} onClick={() => insert(`[${channel.name}]`)}><span style={{ background: channel.color }} /> <b>{channel.name}</b><small>{channel.unit}</small></button>)}</aside></div>
    <footer><span>Saved locally and recalculated for compatible logs.</span><div><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!validation.valid || saving} onClick={save}>{saving ? "Calculating…" : "Create channel"}</button></div></footer>
  </div></div>;
}

function format(id: string | undefined, row: number): string { const value = id ? datasetStore.getColumn(id)?.[row] : undefined; return value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(2); }
