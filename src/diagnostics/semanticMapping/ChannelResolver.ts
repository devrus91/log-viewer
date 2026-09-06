import type { ChannelMappingOverride, ChannelMetadata, SemanticChannelMatch } from "@/domain/types";

interface AliasDefinition { canonical: string; patterns: RegExp[]; }

const ALIASES: AliasDefinition[] = [
  { canonical: "time", patterns: [/^time(?:\s*\(s\))?$/i, /^timestamp$/i, /^log time/i] },
  { canonical: "electrical.batteryVoltage", patterns: [/^battery voltage actual(?:\s|$|\()/i] },
  { canonical: "engine.rpm", patterns: [/^engine speed/i, /^engine rpm/i, /^rpm(?:\s|$|\()/i] },
  { canonical: "engine.cylinderFill", patterns: [/^cylinder fill(?:\s|$|\()(?!.*limit)/i] },
  { canonical: "engine.cylinderFillLimit", patterns: [/^cylinder fill limit(?:\s|$|\()/i] },
  { canonical: "driver.pedal", patterns: [/accelerator pedal/i, /driver demand/i, /pedal position/i] },
  { canonical: "throttle.actual", patterns: [/throttle actual/i, /^throttle(?: position)?(?:\s|$|\()/i] },
  { canonical: "boost.target", patterns: [/boost.*target/i, /target.*boost/i, /charge pressure.*target/i] },
  { canonical: "boost.actual", patterns: [/boost pressure.*actual/i, /boost pressure pre throttle/i, /boost.*filtered/i, /^boost pressure/i, /charge pressure.*actual/i] },
  { canonical: "boost.manifoldTarget", patterns: [/^manifold pressure target(?:\s|$|\()/i] },
  { canonical: "torque.request", patterns: [/torque request/i, /requested torque/i, /torque desired/i] },
  { canonical: "torque.actual", patterns: [/torque actual/i, /actual torque/i, /engine torque(?!.*request)/i] },
  { canonical: "torque.limit", patterns: [/^torque desired max(?:\s|$|\()/i, /torque limit(?!ation state| reason)/i] },
  { canonical: "torque.state", patterns: [/torque limitation state/i, /torque intervention/i] },
  { canonical: "fuel.high.target", patterns: [/(?:high pressure|hpfp|rail).*fuel.*target/i, /fuel pressure.*target/i] },
  { canonical: "fuel.high.actual", patterns: [/(?:high pressure|hpfp|rail).*fuel.*actual/i, /fuel pressure actual/i, /^fuel pressure(?:\s|$|\()/i] },
  { canonical: "fuel.low.actual", patterns: [/(?:low pressure|lpfp).*fuel/i] },
  { canonical: "fuel.ethanol", patterns: [/^flex fuel ethanol content(?:\s|$|\()/i] },
  { canonical: "lambda.target", patterns: [/lambda.*target/i, /target.*lambda/i, /afr.*target/i] },
  { canonical: "lambda.actual", patterns: [/lambda.*actual/i, /^lambda(?:\s|$|\()/i, /afr.*actual/i, /^afr(?:\s|$|\()/i] },
  { canonical: "injector.duty", patterns: [/inject(?:or|ion).*duty/i, /pi duty/i] },
  { canonical: "fuel.stft", patterns: [/short term fuel trim/i, /stft/i] },
  { canonical: "fuel.ltft", patterns: [/long term fuel trim/i, /ltft/i] },
  { canonical: "temperature.iat", patterns: [/intake air temp/i, /^iat(?:\s|$|\()/i, /charge air temp/i] },
  { canonical: "temperature.coolant", patterns: [/engine coolant temp/i, /coolant temp/i, /engine temperature/i] },
  { canonical: "cam.intake.target", patterns: [/intake cam.*target/i, /target.*intake cam/i] },
  { canonical: "cam.intake.actual", patterns: [/intake cam.*actual/i, /actual.*intake cam/i, /^intake cam angle/i] },
  { canonical: "cam.exhaust.target", patterns: [/exhaust cam.*target/i, /target.*exhaust cam/i] },
  { canonical: "cam.exhaust.actual", patterns: [/exhaust cam.*actual/i, /actual.*exhaust cam/i, /^exhaust cam angle/i] },
  { canonical: "air.massFlowTarget", patterns: [/^mass airflow target(?:\s|$|\()/i] },
  { canonical: "transmission.tccSlip", patterns: [/tcc.*slip/i, /converter.*slip/i, /lockup.*slip/i] },
  { canonical: "transmission.tccState", patterns: [/^converter lockup clutch(?:\s|$|\()/i] },
  { canonical: "transmission.outputShaftRpm", patterns: [/^output shaft speed(?:\s|$|\()/i] },
  { canonical: "transmission.gear", patterns: [/^gear(?:\s|$|\()/i, /current gear/i] },
  { canonical: "vehicle.speed", patterns: [/vehicle speed/i, /^speed(?:\s|$|\()/i] },
  { canonical: "ignition.total", patterns: [/ignition timing total/i, /^ignition timing(?!.*cyl)/i, /ignition retard(?!.*cyl)/i] },
];

export const SEMANTIC_CHANNEL_IDS = ALIASES.map((definition) => definition.canonical);

const GROUPS: Array<{ prefix: string; pattern: RegExp }> = [
  { prefix: "ignition.cylinder", pattern: /ignition.*(?:cylinder|cyl)\s*(\d+)/i },
  { prefix: "knock.cylinder", pattern: /knock.*(?:retard)?.*(?:cylinder|cyl)\s*(\d+)/i },
  { prefix: "wheel.speed", pattern: /wheel speed\s*(fl|fr|rl|rr|front left|front right|rear left|rear right)/i },
];

export interface ResolvedChannels { mapping: Map<string, SemanticChannelMatch>; groups: Map<string, SemanticChannelMatch[]>; matches: SemanticChannelMatch[]; }

interface Candidate {
  match: SemanticChannelMatch;
  confidence: number;
  specificity: number;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function specificity(pattern: RegExp, matchedText: string, channelName: string): number {
  const coverage = matchedText.length / Math.max(1, channelName.length);
  const anchored = pattern.source.startsWith("^") ? 0.15 : 0;
  return coverage + anchored + Math.min(0.2, pattern.source.length / 250);
}

function betterCandidate(left: Candidate, right: Candidate): Candidate {
  if (left.confidence !== right.confidence) return left.confidence > right.confidence ? left : right;
  if (left.specificity !== right.specificity) return left.specificity > right.specificity ? left : right;
  const byName = left.match.channelName.localeCompare(right.match.channelName);
  if (byName !== 0) return byName < 0 ? left : right;
  return left.match.channelId.localeCompare(right.match.channelId) <= 0 ? left : right;
}

function groupPrefix(canonical: string): string | undefined {
  return GROUPS.find((definition) => canonical.startsWith(`${definition.prefix}.`))?.prefix;
}

function findOverrideChannel(channels: ChannelMetadata[], override: ChannelMappingOverride): ChannelMetadata | undefined {
  const wanted = normalizeName(override.channelName);
  return channels.find((channel) => normalizeName(channel.name) === wanted)
    ?? channels.find((channel) => normalizeName(channel.originalName) === wanted);
}

export function resolveChannels(channels: ChannelMetadata[], overrides: ChannelMappingOverride[] = []): ResolvedChannels {
  const mapping = new Map<string, SemanticChannelMatch>();
  const groups = new Map<string, SemanticChannelMatch[]>();
  const automatic = new Map<string, Candidate>();
  const automaticGroups = new Map<string, Candidate>();
  const manual = new Map<string, { match: SemanticChannelMatch; updatedAt: number }>();

  for (const override of overrides) {
    const channel = findOverrideChannel(channels, override);
    if (!channel) continue;
    const existing = manual.get(override.canonical);
    if (existing && existing.updatedAt > override.updatedAt) continue;
    manual.set(override.canonical, {
      updatedAt: override.updatedAt,
      match: { canonical: override.canonical, channelId: channel.id, channelName: channel.name, confidence: 1, confirmed: true, source: "manual" },
    });
  }
  const manuallyAssignedChannels = new Set(Array.from(manual.values(), ({ match }) => match.channelId));

  for (const channel of channels) {
    for (const definition of ALIASES) {
      if (manual.has(definition.canonical) || manuallyAssignedChannels.has(channel.id)) continue;
      definition.patterns.forEach((pattern, patternIndex) => {
        const patternMatch = channel.name.match(pattern);
        if (!patternMatch) return;
        const confidence = patternIndex === 0 ? 0.96 : Math.max(0.68, 0.9 - patternIndex * 0.06);
        const candidate: Candidate = {
          confidence,
          specificity: specificity(pattern, patternMatch[0], channel.name),
          match: { canonical: definition.canonical, channelId: channel.id, channelName: channel.name, confidence, confirmed: confidence >= 0.9, source: "automatic" },
        };
        const existing = automatic.get(definition.canonical);
        automatic.set(definition.canonical, existing ? betterCandidate(existing, candidate) : candidate);
      });
    }
    for (const definition of GROUPS) {
      if (manuallyAssignedChannels.has(channel.id)) continue;
      const matchResult = channel.name.match(definition.pattern);
      if (!matchResult) continue;
      const canonical = `${definition.prefix}.${matchResult[1].toLowerCase().replace(/\s+/g, "-")}`;
      if (manual.has(canonical)) continue;
      const candidate: Candidate = {
        confidence: 0.95,
        specificity: specificity(definition.pattern, matchResult[0], channel.name),
        match: { canonical, channelId: channel.id, channelName: channel.name, confidence: 0.95, confirmed: true, source: "automatic" },
      };
      const existing = automaticGroups.get(canonical);
      automaticGroups.set(canonical, existing ? betterCandidate(existing, candidate) : candidate);
    }
  }

  for (const [canonical, candidate] of automatic) mapping.set(canonical, candidate.match);
  for (const [canonical, value] of manual) {
    const prefix = groupPrefix(canonical);
    if (!prefix) mapping.set(canonical, value.match);
  }
  for (const [canonical, candidate] of automaticGroups) {
    const prefix = groupPrefix(canonical)!;
    groups.set(prefix, [...(groups.get(prefix) ?? []), candidate.match]);
  }
  for (const [canonical, value] of manual) {
    const prefix = groupPrefix(canonical);
    if (prefix) groups.set(prefix, [...(groups.get(prefix) ?? []), value.match]);
  }
  for (const values of groups.values()) values.sort((left, right) => left.canonical.localeCompare(right.canonical));
  const matches = [...mapping.values(), ...Array.from(groups.values()).flat()];
  return { mapping, groups, matches };
}
