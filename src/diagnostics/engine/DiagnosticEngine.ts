import { collectDependencies, createFormulaEvaluationContext, evaluateNode, parseFormula, type FormulaEvaluationContext, type FormulaNode } from "@/domain/formula";
import type { ChannelMetadata, DiagnosticAnalysis, DiagnosticCondition, DiagnosticEvent, DiagnosticRuleConfig, DiagnosticSeverity, SemanticChannelMatch } from "@/domain/types";
import { resolveChannels } from "@/diagnostics/semanticMapping/ChannelResolver";
import { detectPulls } from "@/diagnostics/pullDetection/PullDetector";
import { correlateEvents } from "@/diagnostics/correlation/EventCorrelator";
import type { DiagnosticDataset, EventDraft } from "./DiagnosticRule";
import { defaultDiagnosticProfile } from "@/diagnostics/profiles/defaultProfile";

interface AnalyzeInput { channels: ChannelMetadata[]; columns: Record<string, Float64Array>; profile?: DiagnosticDataset["profile"]; }
interface CompiledCondition { left: FormulaNode; right: FormulaNode; operator: DiagnosticCondition["operator"]; }

function canonicalColumns(dataset: DiagnosticDataset): Record<string, Float64Array> {
  const result: Record<string, Float64Array> = {};
  dataset.mapping.forEach((match, canonical) => { const values = dataset.columns[match.channelId]; if (values) result[canonical] = values; });
  dataset.groups.forEach((matches) => matches.forEach((match) => { const values = dataset.columns[match.channelId]; if (values) result[match.canonical] = values; }));
  return result;
}

function compileCondition(condition: DiagnosticCondition, columns: Record<string, Float64Array>): CompiledCondition | null {
  try {
    const left = parseFormula(condition.left);
    const right = parseFormula(condition.right);
    const dependencies = [...collectDependencies(left), ...collectDependencies(right)];
    if (dependencies.some((dependency) => !columns[dependency])) return null;
    return { left, right, operator: condition.operator };
  } catch { return null; }
}

function compare(left: number, right: number, operator: DiagnosticCondition["operator"]): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (operator === "<") return left < right;
  if (operator === "<=") return left <= right;
  if (operator === ">") return left > right;
  if (operator === ">=") return left >= right;
  if (operator === "==") return left === right;
  return left !== right;
}

function conditionAt(condition: CompiledCondition, row: number, columns: Record<string, Float64Array>, parameters: Record<string, number>, context?: FormulaEvaluationContext): boolean {
  try { return compare(evaluateNode(condition.left, row, columns, parameters, context), evaluateNode(condition.right, row, columns, parameters, context), condition.operator); }
  catch { return false; }
}

function conditionMask(rule: DiagnosticRuleConfig, columns: Record<string, Float64Array>, rowCount: number, conditions = rule.conditions): Uint8Array | null {
  const compiled = conditions.map((condition) => compileCondition(condition, columns));
  const available = compiled.filter((condition): condition is CompiledCondition => condition !== null);
  const anyMode = rule.detectorOptions.conditionMode === "any";
  if ((!anyMode && available.length !== conditions.length) || available.length === 0) return null;
  const mask = new Uint8Array(rowCount);
  const context = createFormulaEvaluationContext(rowCount);
  for (let row = 0; row < rowCount; row += 1) mask[row] = Number(anyMode ? available.some((condition) => conditionAt(condition, row, columns, rule.parameters, context)) : available.every((condition) => conditionAt(condition, row, columns, rule.parameters, context)));
  return mask;
}

function segments(mask: Uint8Array, time: Float64Array, minimumDurationMs: number, cooldownMs: number): Array<[number, number]> {
  const raw: Array<[number, number]> = [];
  let start = -1;
  for (let row = 0; row <= mask.length; row += 1) {
    if (row < mask.length && mask[row] && start < 0) start = row;
    if ((row === mask.length || !mask[row]) && start >= 0) {
      const end = row - 1;
      if ((time[end] - time[start]) * 1000 >= minimumDurationMs || start === end && minimumDurationMs <= 0) raw.push([start, end]);
      start = -1;
    }
  }
  const merged: Array<[number, number]> = [];
  for (const item of raw) {
    const previous = merged.at(-1);
    if (previous && (time[item[0]] - time[previous[1]]) * 1000 <= cooldownMs) previous[1] = item[1];
    else merged.push(item);
  }
  return merged;
}

function peakIndexFor(rule: DiagnosticRuleConfig, start: number, end: number, columns: Record<string, Float64Array>, condition?: DiagnosticCondition): number {
  if (!condition) return Math.floor((start + end) / 2);
  const compiled = compileCondition(condition, columns);
  if (!compiled) return Math.floor((start + end) / 2);
  const direction = String(rule.detectorOptions.peakDirection ?? (condition.operator.includes("<") ? "min" : "max"));
  const context = createFormulaEvaluationContext(Math.max(0, ...Object.values(columns).map((values) => values.length)));
  let peak = start;
  let peakValue = evaluateNode(compiled.left, start, columns, rule.parameters, context) - evaluateNode(compiled.right, start, columns, rule.parameters, context);
  for (let row = start + 1; row <= end; row += 1) {
    const value = evaluateNode(compiled.left, row, columns, rule.parameters, context) - evaluateNode(compiled.right, row, columns, rule.parameters, context);
    if (direction === "min" ? value < peakValue : value > peakValue) { peak = row; peakValue = value; }
  }
  return peak;
}

function expandRecommended(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset): string[] {
  return Array.from(new Set(rule.recommendedChannels.flatMap((canonical) => {
    if (canonical.endsWith(".*")) return (dataset.groups.get(canonical.slice(0, -2)) ?? []).map((match) => match.channelId);
    const id = dataset.mapping.get(canonical)?.channelId;
    return id ? [id] : [];
  })));
}

function createEvent(rule: DiagnosticRuleConfig, draft: EventDraft, dataset: DiagnosticDataset): DiagnosticEvent {
  const rpmId = dataset.mapping.get("engine.rpm")?.channelId;
  const rpm = rpmId ? dataset.columns[rpmId] : undefined;
  const severity = draft.severity ?? rule.severity;
  return { id: `${rule.id}-${draft.startIndex}-${draft.endIndex}`, ruleId: rule.id, name: rule.name, category: rule.category, severity, startTime: dataset.time[draft.startIndex], endTime: dataset.time[draft.endIndex], peakTime: dataset.time[draft.peakIndex], startIndex: draft.startIndex, endIndex: draft.endIndex, peakIndex: draft.peakIndex, rpmStart: rpm && Number.isFinite(rpm[draft.startIndex]) ? rpm[draft.startIndex] : null, rpmEnd: rpm && Number.isFinite(rpm[draft.endIndex]) ? rpm[draft.endIndex] : null, peakRpm: rpm && Number.isFinite(rpm[draft.peakIndex]) ? rpm[draft.peakIndex] : null, values: draft.values ?? {}, message: draft.message, confidence: draft.confidence ?? "high", possibleCauses: rule.possibleCauses, relatedChannels: draft.relatedChannels ?? expandRecommended(rule, dataset), occurrences: draft.occurrences ?? 1, correlatedEventIds: [] };
}

function severityAt(rule: DiagnosticRuleConfig, index: number, columns: Record<string, Float64Array>): DiagnosticSeverity {
  if (!rule.criticalCondition) return rule.severity;
  const compiled = compileCondition(rule.criticalCondition, columns);
  return compiled && conditionAt(compiled, index, columns, rule.parameters) ? "critical" : rule.severity;
}

function temporal(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset, columns: Record<string, Float64Array>): DiagnosticEvent[] {
  const mask = conditionMask(rule, columns, dataset.time.length);
  if (!mask) return [];
  return segments(mask, dataset.time, rule.durationMs, rule.cooldownMs).map(([startIndex, endIndex]) => {
    const peakIndex = peakIndexFor(rule, startIndex, endIndex, columns, rule.conditions[0]);
    return createEvent(rule, { startIndex, endIndex, peakIndex, severity: severityAt(rule, peakIndex, columns), message: rule.message }, dataset);
  });
}

function groupTemporal(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset, columns: Record<string, Float64Array>): DiagnosticEvent[] {
  const group = String(rule.detectorOptions.group ?? "");
  const fallback = String(rule.detectorOptions.fallback ?? "");
  const token = String(rule.detectorOptions.signalToken ?? "SIGNAL");
  const matches = [...(dataset.groups.get(group) ?? []), ...(dataset.groups.get(group)?.length ? [] : fallback && dataset.mapping.get(fallback) ? [dataset.mapping.get(fallback)!] : [])];
  return matches.flatMap((match) => {
    const replace = (condition: DiagnosticCondition): DiagnosticCondition => ({ ...condition, left: condition.left.replaceAll(`[${token}]`, `[${match.canonical}]`), right: condition.right.replaceAll(`[${token}]`, `[${match.canonical}]`) });
    const localRule = { ...rule, conditions: rule.conditions.map(replace), criticalCondition: rule.criticalCondition ? replace(rule.criticalCondition) : undefined };
    return temporal(localRule, dataset, columns).map((event) => ({ ...event, id: `${event.id}-${match.canonical}`, name: matches.length > 1 ? `${rule.name} · ${match.channelName}` : rule.name, relatedChannels: Array.from(new Set([match.channelId, ...event.relatedChannels])), values: { ...event.values, signal: match.channelName, peak: dataset.columns[match.channelId][event.peakIndex] } }));
  });
}

function rate(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset, columns: Record<string, Float64Array>): DiagnosticEvent[] {
  const canonical = String(rule.detectorOptions.channel ?? "");
  const values = columns[canonical];
  const threshold = rule.parameters[String(rule.detectorOptions.thresholdParameter ?? "THRESHOLD")];
  if (!values || threshold === undefined) return [];
  const base = rule.conditions.length ? conditionMask(rule, columns, dataset.time.length) : new Uint8Array(dataset.time.length).fill(1);
  if (!base) return [];
  const mask = new Uint8Array(values.length);
  const operator = String(rule.detectorOptions.operator ?? "<");
  const rates = new Float64Array(values.length); rates.fill(Number.NaN);
  for (let index = 1; index < values.length; index += 1) { const dt = dataset.time[index] - dataset.time[index - 1]; rates[index] = dt > 0 ? (values[index] - values[index - 1]) / dt : Number.NaN; mask[index] = Number(Boolean(base[index]) && compare(rates[index], threshold, operator as DiagnosticCondition["operator"])); }
  return segments(mask, dataset.time, rule.durationMs, rule.cooldownMs).map(([startIndex, endIndex]) => { let peakIndex = startIndex; for (let index = startIndex + 1; index <= endIndex; index += 1) if (operator.includes("<") ? rates[index] < rates[peakIndex] : rates[index] > rates[peakIndex]) peakIndex = index; return createEvent(rule, { startIndex, endIndex, peakIndex, message: rule.message, values: { rate: rates[peakIndex], signal: canonical } }, dataset); });
}

function suddenDrop(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset, columns: Record<string, Float64Array>): DiagnosticEvent[] {
  const canonical = String(rule.detectorOptions.channel ?? ""); const values = columns[canonical];
  const delta = rule.parameters[String(rule.detectorOptions.deltaParameter ?? "DELTA")]; const lookbackMs = rule.parameters[String(rule.detectorOptions.lookbackParameter ?? "LOOKBACK_MS")];
  if (!values || delta === undefined || lookbackMs === undefined) return [];
  const base = conditionMask(rule, columns, dataset.time.length); if (!base) return [];
  const mask = new Uint8Array(values.length); const drops = new Float64Array(values.length); let previous = 0;
  for (let index = 1; index < values.length; index += 1) { while (previous < index - 1 && (dataset.time[index] - dataset.time[previous]) * 1000 > lookbackMs) previous += 1; drops[index] = values[previous] - values[index]; mask[index] = Number(Boolean(base[index]) && drops[index] > delta); }
  return segments(mask, dataset.time, rule.durationMs, rule.cooldownMs).map(([startIndex, endIndex]) => { let peakIndex = startIndex; for (let index = startIndex + 1; index <= endIndex; index += 1) if (drops[index] > drops[peakIndex]) peakIndex = index; return createEvent(rule, { startIndex, endIndex, peakIndex, message: rule.message, values: { drop: drops[peakIndex] } }, dataset); });
}

function groupDeviation(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset, wheelMode = false): DiagnosticEvent[] {
  const group = String(rule.detectorOptions.group ?? ""); const matches = dataset.groups.get(group) ?? [];
  const threshold = rule.parameters[String(rule.detectorOptions.thresholdParameter ?? "MAX_DEVIATION")]; if (matches.length < (wheelMode ? 2 : 3) || threshold === undefined) return [];
  return matches.flatMap((match) => { const values = dataset.columns[match.channelId]; const mask = new Uint8Array(dataset.time.length); const deviation = new Float64Array(dataset.time.length);
    for (let row = 0; row < dataset.time.length; row += 1) { const peers = matches.filter((item) => item.channelId !== match.channelId).map((item) => dataset.columns[item.channelId][row]).filter(Number.isFinite).sort((a, b) => a - b); if (!Number.isFinite(values[row]) || peers.length === 0) continue; const median = peers[Math.floor(peers.length / 2)]; deviation[row] = Math.abs(values[row] - median); mask[row] = Number(deviation[row] > threshold); }
    return segments(mask, dataset.time, rule.durationMs, rule.cooldownMs).map(([startIndex, endIndex]) => { let peakIndex = startIndex; for (let row = startIndex + 1; row <= endIndex; row += 1) if (deviation[row] > deviation[peakIndex]) peakIndex = row; const criticalThreshold = rule.parameters[String(rule.detectorOptions.criticalParameter ?? "CRITICAL_DEVIATION")]; return createEvent(rule, { startIndex, endIndex, peakIndex, severity: criticalThreshold !== undefined && deviation[peakIndex] > criticalThreshold ? "critical" : rule.severity, message: rule.message, values: { signal: match.channelName, deviation: deviation[peakIndex] }, relatedChannels: [match.channelId, ...expandRecommended(rule, dataset)] }, dataset); });
  });
}

function repeatedGroup(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset): DiagnosticEvent[] {
  const matches = dataset.groups.get(String(rule.detectorOptions.group ?? "")) ?? []; const threshold = rule.parameters[String(rule.detectorOptions.thresholdParameter ?? "THRESHOLD")]; const minimumCount = rule.parameters[String(rule.detectorOptions.countParameter ?? "MIN_EVENTS")]; const windowMs = rule.parameters[String(rule.detectorOptions.windowParameter ?? "WINDOW_MS")]; if (!threshold || !minimumCount || !windowMs) return [];
  return matches.flatMap((match) => { const values = dataset.columns[match.channelId]; const mask = Uint8Array.from(values, (value) => Number(value < threshold)); const episodes = segments(mask, dataset.time, 0, 0); if (episodes.length < minimumCount) return []; let best: Array<[number, number]> = []; for (let left = 0; left < episodes.length; left += 1) { const candidates = episodes.slice(left).filter((episode) => (dataset.time[episode[0]] - dataset.time[episodes[left][0]]) * 1000 <= windowMs); if (candidates.length > best.length) best = candidates; } if (best.length < minimumCount) return []; let peakIndex = best[0][0]; best.forEach(([start, end]) => { for (let row = start; row <= end; row += 1) if (values[row] < values[peakIndex]) peakIndex = row; }); return [createEvent(rule, { startIndex: best[0][0], endIndex: best.at(-1)![1], peakIndex, severity: values[peakIndex] < (rule.parameters.CRITICAL_RETARD ?? -Infinity) ? "critical" : rule.severity, message: rule.message, occurrences: best.length, values: { cylinder: match.channelName, maximumRetard: values[peakIndex], events: best.length }, relatedChannels: [match.channelId, ...expandRecommended(rule, dataset)] }, dataset)]; });
}

function wheelMismatch(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset): DiagnosticEvent[] {
  const matches = dataset.groups.get(String(rule.detectorOptions.group ?? "wheel.speed")) ?? []; const threshold = rule.parameters[String(rule.detectorOptions.thresholdParameter ?? "MAX_MISMATCH")]; if (matches.length < 2 || threshold === undefined) return [];
  const mask = new Uint8Array(dataset.time.length); const spread = new Float64Array(dataset.time.length); const speedId = dataset.mapping.get("vehicle.speed")?.channelId; const speed = speedId ? dataset.columns[speedId] : undefined; const minimumSpeed = rule.parameters[String(rule.detectorOptions.minimumSpeedParameter ?? "MIN_SPEED")] ?? 0;
  for (let row = 0; row < dataset.time.length; row += 1) { const values = matches.map((match) => dataset.columns[match.channelId][row]).filter(Number.isFinite); if (values.length < 2 || speed && speed[row] < minimumSpeed) continue; spread[row] = Math.max(...values) - Math.min(...values); mask[row] = Number(spread[row] > threshold); }
  return segments(mask, dataset.time, rule.durationMs, rule.cooldownMs).map(([startIndex, endIndex]) => { let peakIndex = startIndex; for (let row = startIndex + 1; row <= endIndex; row += 1) if (spread[row] > spread[peakIndex]) peakIndex = row; return createEvent(rule, { startIndex, endIndex, peakIndex, severity: spread[peakIndex] > (rule.parameters.CRITICAL_MISMATCH ?? Infinity) ? "critical" : rule.severity, message: rule.message, values: { mismatch: spread[peakIndex] } }, dataset); });
}

function expandCandidates(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset): Array<{ canonical: string; match: SemanticChannelMatch }> {
  const candidates = rule.detectorOptions.candidates; if (!Array.isArray(candidates)) return [];
  return candidates.flatMap((candidate) => { if (candidate.endsWith(".*")) return (dataset.groups.get(candidate.slice(0, -2)) ?? []).map((match) => ({ canonical: match.canonical, match })); const match = dataset.mapping.get(candidate); return match ? [{ canonical: candidate, match }] : []; });
}

function dropout(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset): DiagnosticEvent[] {
  const minimumSamples = rule.parameters[String(rule.detectorOptions.minimumSamplesParameter ?? "MIN_SAMPLES")];
  if (minimumSamples === undefined) return [];
  return expandCandidates(rule, dataset).flatMap(({ match }) => {
    const values = dataset.columns[match.channelId]; const events: DiagnosticEvent[] = []; let start = -1;
    for (let row = 1; row < values.length; row += 1) {
      const invalid = !Number.isFinite(values[row]) || values[row] === 0;
      if (invalid && start < 0) start = row;
      if ((!invalid || row === values.length - 1) && start >= 0) {
        const end = invalid ? row : row - 1; const before = values[start - 1]; const after = values[Math.min(values.length - 1, end + 1)];
        if (end - start + 1 >= minimumSamples && Number.isFinite(before) && before !== 0 && Number.isFinite(after) && after !== 0) events.push(createEvent(rule, { startIndex: start, endIndex: end, peakIndex: start, message: rule.message, values: { signal: match.channelName, samples: end - start + 1 }, relatedChannels: [match.channelId] }, dataset));
        start = -1;
      }
    }
    return events;
  });
}

function impossibleRate(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset): DiagnosticEvent[] {
  return expandCandidates(rule, dataset).flatMap(({ canonical, match }) => { const values = dataset.columns[match.channelId]; let threshold = rule.parameters.WHEEL_RATE; if (canonical.startsWith("boost.")) threshold = rule.parameters.BOOST_RATE; else if (canonical.startsWith("temperature.")) threshold = rule.parameters.TEMPERATURE_RATE; if (threshold === undefined) return []; const rates = new Float64Array(values.length); const mask = new Uint8Array(values.length); for (let row = 1; row < values.length; row += 1) { const dt = dataset.time[row] - dataset.time[row - 1]; rates[row] = dt > 0 ? Math.abs(values[row] - values[row - 1]) / dt : 0; mask[row] = Number(rates[row] > threshold); } return segments(mask, dataset.time, 0, rule.cooldownMs).map(([startIndex, endIndex]) => { let peakIndex = startIndex; for (let row = startIndex + 1; row <= endIndex; row += 1) if (rates[row] > rates[peakIndex]) peakIndex = row; return createEvent(rule, { startIndex, endIndex, peakIndex, message: rule.message, values: { signal: match.channelName, rate: rates[peakIndex] }, relatedChannels: [match.channelId] }, dataset); }); });
}

function stuck(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset): DiagnosticEvent[] {
  const rpmMatch = dataset.mapping.get("engine.rpm"); const rpm = rpmMatch ? dataset.columns[rpmMatch.channelId] : undefined; if (!rpm) return [];
  const rpmChannelId = rpmMatch!.channelId;
  const durationMs = rule.parameters[String(rule.detectorOptions.durationParameter ?? "DURATION_MS")] ?? rule.durationMs; const rpmChange = rule.parameters[String(rule.detectorOptions.rpmChangeParameter ?? "RPM_CHANGE")] ?? 500; const epsilon = rule.parameters[String(rule.detectorOptions.epsilonParameter ?? "EPSILON")] ?? 0;
  return expandCandidates(rule, dataset).flatMap(({ match }) => { const values = dataset.columns[match.channelId]; const result: DiagnosticEvent[] = []; let start = 0; for (let row = 1; row <= values.length; row += 1) { if (row < values.length && Math.abs(values[row] - values[row - 1]) <= epsilon) continue; const end = row - 1; if ((dataset.time[end] - dataset.time[start]) * 1000 >= durationMs && Math.abs(rpm[end] - rpm[start]) >= rpmChange) result.push(createEvent(rule, { startIndex: start, endIndex: end, peakIndex: Math.floor((start + end) / 2), message: rule.message, confidence: "medium", values: { signal: match.channelName, fixedValue: values[start] }, relatedChannels: [match.channelId, rpmChannelId] }, dataset)); start = row; } return result; });
}

function gearShift(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset): DiagnosticEvent[] {
  const canonical = String(rule.detectorOptions.channel ?? "transmission.gear"); const values = canonicalColumns(dataset)[canonical]; if (!values) return [];
  return Array.from({ length: values.length - 1 }, (_, row) => row + 1).filter((row) => Number.isFinite(values[row]) && Number.isFinite(values[row - 1]) && Math.round(values[row]) !== Math.round(values[row - 1])).map((row) => createEvent(rule, { startIndex: Math.max(0, row - 1), endIndex: Math.min(values.length - 1, row + 1), peakIndex: row, message: rule.message, values: { fromGear: Math.round(values[row - 1]), toGear: Math.round(values[row]) } }, dataset));
}

function pullEvents(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset): DiagnosticEvent[] { return dataset.pulls.map((pull, index) => createEvent(rule, { startIndex: pull.startIndex, endIndex: pull.endIndex, peakIndex: pull.endIndex, message: `${rule.message} Pull #${index + 1}: ${pull.startRpm.toFixed(0)} → ${pull.endRpm.toFixed(0)} rpm.`, values: { pull: index + 1, startRpm: pull.startRpm, endRpm: pull.endRpm, peakBoost: pull.peakBoost ?? "—" } }, dataset)); }

function restrictToWot(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset, events: DiagnosticEvent[]): DiagnosticEvent[] {
  if (!rule.wotOnly || rule.detector === "pull") return events;
  return events.flatMap((event) => dataset.pulls.flatMap((pull, pullIndex) => {
    const startIndex = Math.max(event.startIndex, pull.startIndex);
    const endIndex = Math.min(event.endIndex, pull.endIndex);
    if (startIndex > endIndex) return [];
    const peakIndex = Math.min(endIndex, Math.max(startIndex, event.peakIndex));
    return [{ ...event, id: `${event.id}-wot-${pullIndex}-${startIndex}-${endIndex}`, startIndex, endIndex, peakIndex, startTime: dataset.time[startIndex], endTime: dataset.time[endIndex], peakTime: dataset.time[peakIndex] }];
  }));
}

function ensureUniqueEventIds(events: DiagnosticEvent[]): DiagnosticEvent[] {
  const occurrences = new Map<string, number>();
  return events.map((event) => {
    const occurrence = (occurrences.get(event.id) ?? 0) + 1;
    occurrences.set(event.id, occurrence);
    return occurrence === 1 ? event : { ...event, id: `${event.id}-${occurrence}` };
  });
}

function runRule(rule: DiagnosticRuleConfig, dataset: DiagnosticDataset): DiagnosticEvent[] {
  if (!rule.enabled) return [];
  const columns = canonicalColumns(dataset);
  let events: DiagnosticEvent[];
  if (rule.detector === "temporal") events = temporal(rule, dataset, columns);
  else if (rule.detector === "rate") events = rate(rule, dataset, columns);
  else if (rule.detector === "sudden-drop") events = suddenDrop(rule, dataset, columns);
  else if (rule.detector === "group-temporal") events = groupTemporal(rule, dataset, columns);
  else if (rule.detector === "cylinder-deviation") events = groupDeviation(rule, dataset);
  else if (rule.detector === "repeated-group") events = repeatedGroup(rule, dataset);
  else if (rule.detector === "wheel-mismatch") events = wheelMismatch(rule, dataset);
  else if (rule.detector === "wheel-spike") events = groupDeviation(rule, dataset, true);
  else if (rule.detector === "dropout") events = dropout(rule, dataset);
  else if (rule.detector === "impossible-rate") events = impossibleRate(rule, dataset);
  else if (rule.detector === "stuck") events = stuck(rule, dataset);
  else if (rule.detector === "gear-shift") events = gearShift(rule, dataset);
  else events = pullEvents(rule, dataset);
  return restrictToWot(rule, dataset, events);
}

export function analyzeDataset(input: AnalyzeInput): DiagnosticAnalysis {
  const profile = input.profile ?? defaultDiagnosticProfile;
  const resolved = resolveChannels(input.channels);
  const timeMatch = resolved.mapping.get("time");
  const timeId = timeMatch?.channelId ?? input.channels.find((channel) => /time/i.test(channel.name))?.id ?? input.channels[0]?.id;
  const time = input.columns[timeId] ?? new Float64Array(0);
  const pullRule = profile.rules.find((rule) => rule.id === "wot-pull-detection") ?? defaultDiagnosticProfile.rules.find((rule) => rule.id === "wot-pull-detection")!;
  const pulls = detectPulls({ columns: input.columns, mapping: resolved.mapping, time, rule: pullRule });
  const dataset: DiagnosticDataset = { channels: input.channels, columns: input.columns, time, mapping: resolved.mapping, groups: resolved.groups, profile, pulls };
  const correlationWindowMs = Math.max(0, ...profile.rules.map((rule) => rule.correlationWindowMs));
  const events = correlateEvents(ensureUniqueEventIds(profile.rules.flatMap((rule) => runRule(rule, dataset)).sort((a, b) => a.startTime - b.startTime)), correlationWindowMs);
  for (const pull of pulls) {
    const related = events.filter((event) => event.startTime <= pull.endTime && event.endTime >= pull.startTime);
    pull.severity = related.some((event) => event.severity === "critical") ? "critical" : related.some((event) => event.severity === "warning") ? "warning" : "info";
  }
  const counts = { critical: events.filter((event) => event.severity === "critical").length, warning: events.filter((event) => event.severity === "warning").length, info: events.filter((event) => event.severity === "info").length };
  const score = Math.max(0, 100 - counts.critical * 18 - counts.warning * 5 - Math.min(10, counts.info));
  const health = counts.critical ? "critical-events" : counts.warning >= 3 ? "attention-required" : counts.warning ? "minor-warnings" : "healthy";
  return { events, pulls, semanticMapping: resolved.matches, counts, health, score, profileId: profile.id, completedAt: Date.now() };
}
