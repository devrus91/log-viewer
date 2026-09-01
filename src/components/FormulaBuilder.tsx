"use client";

import { useState } from "react";
import { CheckCircle2, Plus, X, XCircle } from "lucide-react";
import { materializeCalculatedChannels } from "@/data/calculated-channels";
import { datasetStore } from "@/data/dataset-store";
import { collectDependencies, collectParameters, hasCycle, parseFormula } from "@/domain/formula";
import { safeId } from "@/data/csv";
import { loadCalculatedChannelDefinitions, saveCalculatedChannelDefinition } from "@/persistence/calculated-channels";
import { calculateFormulaInWorker } from "@/workers/client";
import { useWorkspaceStore } from "@/state/workspace-store";
import type { CalculatedChannelDefinition, ChannelMetadata } from "@/domain/types";
import { AccessibleDialog } from "@/components/AccessibleDialog";

interface FormulaBuilderProps { editingChannelId?: string | null; onClose: () => void; }

export function FormulaBuilder({ editingChannelId = null, onClose }: FormulaBuilderProps) {
  const { channels, metadata, addCalculatedChannel, updateCalculatedChannels } = useWorkspaceStore();
  const editingChannel = channels.find((channel) => channel.id === editingChannelId && channel.type === "calculated");
  const [initial] = useState(() => {
    const definitions = loadCalculatedChannelDefinitions();
    const definition = editingChannelId ? definitions.find((item) => item.id === editingChannelId) : undefined;
    return { definitions, name: definition?.name ?? editingChannel?.name ?? "Boost Error", unit: definition?.unit ?? editingChannel?.unit ?? "bar", expression: definition?.expression ?? editingChannel?.expression ?? "", parameters: Object.entries(definition?.parameters ?? {}).map(([parameterName, value]) => ({ name: parameterName, value })) };
  });
  const [name, setName] = useState(initial.name);
  const [unit, setUnit] = useState(initial.unit);
  const [expression, setExpression] = useState(initial.expression);
  const [parameters, setParameters] = useState(initial.parameters);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const validation = (() => {
    if (!name.trim()) return { valid: false, message: "Enter a channel name" };
    const duplicate = channels.find((channel) => channel.id !== editingChannelId && channel.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
    if (duplicate) return { valid: false, message: `Channel “${duplicate.name}” already exists` };
    const duplicateDefinition = initial.definitions.find((definition) => definition.id !== editingChannelId && definition.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
    if (duplicateDefinition) return { valid: false, message: `Saved channel “${duplicateDefinition.name}” already exists` };
    if (!expression.trim()) return { valid: false, message: "Enter a formula" };
    try {
      const ast = parseFormula(expression);
      const dependencies = Array.from(collectDependencies(ast));
      const missing = dependencies.find((dependency) => !channels.some((channel) => channel.id !== editingChannelId && channel.name === dependency));
      if (missing) return { valid: false, message: `Unknown channel “${missing}”` };
      if (parameters.some((parameter) => !parameter.name.trim())) return { valid: false, message: "Parameter names cannot be empty" };
      if (parameters.some((parameter) => !Number.isFinite(parameter.value))) return { valid: false, message: "Parameter values must be numbers" };
      const parameterNames = parameters.map((parameter) => parameter.name.trim()).filter(Boolean);
      if (new Set(parameterNames).size !== parameterNames.length) return { valid: false, message: "Parameter names must be unique" };
      const missingParameter = Array.from(collectParameters(ast)).find((parameter) => !parameterNames.includes(parameter));
      if (missingParameter) return { valid: false, message: `Missing parameter “${missingParameter}”` };
      if (createsDependencyCycle(initial.definitions, editingChannelId, editingChannel?.name, name.trim(), expression.trim())) return { valid: false, message: "Formula creates a calculated-channel dependency cycle" };
      return { valid: true, message: `${dependencies.length} dependencies resolved` };
    } catch (error) { return { valid: false, message: error instanceof Error ? error.message : "Invalid formula" }; }
  })();

  const insert = (value: string) => setExpression((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${value}`);
  const save = async () => {
    if (!validation.valid || !metadata || !name.trim()) return;
    setSaving(true);
    try {
      const namedColumns: Record<string, Float64Array> = {};
      channels.forEach((channel) => { const values = datasetStore.getColumn(channel.id); if (channel.id !== editingChannelId && values) namedColumns[channel.name] = values; });
      const parameterValues = Object.fromEntries(parameters.map((parameter) => [parameter.name.trim(), parameter.value]));
      const values = await calculateFormulaInWorker(expression, namedColumns, parameterValues, metadata.rows);
      const definition = saveCalculatedChannelDefinition({ id: editingChannelId ?? `calc-${safeId(name, channels.length)}`, name: name.trim(), unit: unit.trim() || "—", expression: expression.trim(), parameters: parameterValues, color: editingChannel?.color ?? "#f472b6", createdAt: Date.now() });
      if (editingChannelId) {
        const rawChannels = channels.filter((channel) => channel.type !== "calculated");
        const rawColumns = Object.fromEntries(rawChannels.flatMap((channel) => { const column = datasetStore.getColumn(channel.id); return column ? [[channel.id, column] as const] : []; }));
        const recalculated = await materializeCalculatedChannels(loadCalculatedChannelDefinitions(), rawChannels, rawColumns, metadata.rows, calculateFormulaInWorker);
        if (!recalculated.some(({ channel }) => channel.id === definition.id)) throw new Error("Could not recalculate the edited channel");
        recalculated.forEach(({ channel, values: recalculatedValues }) => datasetStore.setColumn(channel, recalculatedValues));
        updateCalculatedChannels(recalculated.map(({ channel }) => channel), definition.id);
      } else {
        let min = Infinity; let max = -Infinity; let sum = 0; let count = 0;
        for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); sum += value; count += 1; }
        const channel: ChannelMetadata = { id: definition.id, name: definition.name, originalName: definition.name, unit: definition.unit, group: "Calculated", type: "calculated", min, max, average: count ? sum / count : Number.NaN, sampleCount: count, color: definition.color, expression: definition.expression };
        datasetStore.setColumn(channel, values);
        addCalculatedChannel(channel);
      }
      onClose();
    } catch (reason) { setSaveError(reason instanceof Error ? reason.message : "Could not save the channel"); }
    finally { setSaving(false); }
  };
  const previewDependencies = validation.valid ? Array.from(collectDependencies(parseFormula(expression))) : [];
  return <AccessibleDialog className="formula-modal" ariaLabelledBy="formula-builder-title" onClose={onClose} closeOnBackdrop>
    <header><div><span className="eyebrow">CALCULATED CHANNEL</span><h2 id="formula-builder-title">{editingChannelId ? "Edit calculated channel" : "Formula Builder"}</h2><p>{editingChannelId ? "Update the selected signal and recalculate its dependent channels." : "Create a safe, reusable signal from original samples."}</p></div><button aria-label="Close formula builder" onClick={onClose}><X size={18} /></button></header>
    <div className="formula-body"><section className="formula-editor">
      <div className="control-grid"><label className="field"><span>Channel name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field"><span>Unit</span><input value={unit} onChange={(event) => setUnit(event.target.value)} /></label></div>
      <label className="field"><span>Expression</span><textarea value={expression} onChange={(event) => setExpression(event.target.value)} placeholder="[Boost Pressure Actual (bar)] - [Boost Pressure Target (bar)]" spellCheck={false} /></label>
      <div className="operator-palette">{["+", "−", "×", "/", "%", "^", "(", ")", ">", "<=", "AND", "OR", "abs()", "max()", "clamp()", "if()"].map((operator) => <button key={operator} onClick={() => insert(operator.replace("−", "-").replace("×", "*").replace("()", "("))}>{operator}</button>)}</div>
      <div className={`validation ${validation.valid ? "valid" : "invalid"}`} role="status" aria-live="polite">{validation.valid ? <CheckCircle2 size={16} /> : <XCircle size={16} />}<div><b>{validation.valid ? "Formula valid" : "Formula error"}</b><span>{validation.message}</span></div></div>
      {saveError && <div className="formula-save-error" role="alert"><XCircle size={15} />{saveError}</div>}
      <div className="parameters-head"><h3>Reusable parameters</h3><button onClick={() => setParameters((values) => [...values, { name: `PARAM_${values.length + 1}`, value: 1 }])}><Plus size={14} /> Add parameter</button></div>
      {parameters.map((parameter, index) => <div className="parameter-row" key={index}><input aria-label={`Parameter ${index + 1} name`} value={parameter.name} onChange={(event) => setParameters((values) => values.map((value, item) => item === index ? { ...value, name: event.target.value.toUpperCase() } : value))} /><span>=</span><input aria-label={`Parameter ${index + 1} value`} type="number" value={parameter.value} onChange={(event) => setParameters((values) => values.map((value, item) => item === index ? { ...value, value: Number(event.target.value) } : value))} /><button aria-label={`Remove parameter ${parameter.name || index + 1}`} onClick={() => setParameters((values) => values.filter((_, item) => item !== index))}><X size={14} /></button></div>)}
      <div className="formula-preview"><div><span>PREVIEW</span><small>First 4 original samples</small></div><table><thead><tr>{previewDependencies.slice(0, 2).map((dependency) => <th key={dependency}>{dependency}</th>)}<th>{name || "Calculated"}</th></tr></thead><tbody>{[0, 1, 2, 3].map((row) => <tr key={row}>{previewDependencies.slice(0, 2).map((dependency) => <td key={dependency}>{format(channels.find((channel) => channel.name === dependency)?.id, row)}</td>)}<td className="preview-pending">{validation.valid ? "ready" : "—"}</td></tr>)}</tbody></table></div>
    </section><aside className="formula-channels"><div className="section-kicker"><span>CHANNELS</span><span>CLICK TO INSERT</span></div>{channels.filter((channel) => channel.id !== editingChannelId).map((channel) => <button key={channel.id} onClick={() => insert(`[${channel.name}]`)}><span style={{ background: channel.color }} /> <b>{channel.name}</b><small>{channel.unit}</small></button>)}</aside></div>
    <footer><span>Saved locally and recalculated for compatible logs.</span><div><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!validation.valid || saving} onClick={save}>{saving ? "Calculating…" : editingChannelId ? "Save changes" : "Create channel"}</button></div></footer>
  </AccessibleDialog>;
}

function format(id: string | undefined, row: number): string { const value = id ? datasetStore.getColumn(id)?.[row] : undefined; return value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(2); }

function createsDependencyCycle(definitions: CalculatedChannelDefinition[], editingId: string | null, previousName: string | undefined, nextName: string, expression: string): boolean {
  const candidate: CalculatedChannelDefinition = { id: editingId ?? "__candidate__", name: nextName, unit: "", expression, parameters: {}, color: "", createdAt: 0 };
  const graphDefinitions = editingId && definitions.some((definition) => definition.id === editingId) ? definitions.map((definition) => definition.id === editingId ? candidate : definition) : [...definitions, candidate];
  const graph: Record<string, string[]> = {};
  graphDefinitions.forEach((definition) => {
    try {
      const nodeName = definition.id === editingId ? nextName : definition.name;
      graph[nodeName] = Array.from(collectDependencies(parseFormula(definition.expression))).map((dependency) => previousName && dependency === previousName ? nextName : dependency);
    } catch { /* Invalid stored definitions cannot form a usable dependency edge. */ }
  });
  return hasCycle(graph);
}
