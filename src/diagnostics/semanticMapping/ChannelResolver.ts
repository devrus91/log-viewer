import type { ChannelMetadata, SemanticChannelMatch } from "@/domain/types";

interface AliasDefinition { canonical: string; patterns: RegExp[]; }

const ALIASES: AliasDefinition[] = [
  { canonical: "time", patterns: [/^time(?:\s*\(s\))?$/i, /^timestamp$/i, /^log time/i] },
  { canonical: "engine.rpm", patterns: [/^engine speed/i, /^engine rpm/i, /^rpm(?:\s|$|\()/i] },
  { canonical: "driver.pedal", patterns: [/accelerator pedal/i, /driver demand/i, /pedal position/i] },
  { canonical: "throttle.actual", patterns: [/throttle actual/i, /^throttle(?: position)?(?:\s|$|\()/i] },
  { canonical: "boost.target", patterns: [/boost.*target/i, /target.*boost/i, /charge pressure.*target/i] },
  { canonical: "boost.actual", patterns: [/boost pressure.*actual/i, /boost pressure pre throttle/i, /boost.*filtered/i, /^boost pressure/i, /charge pressure.*actual/i] },
  { canonical: "torque.request", patterns: [/torque request/i, /requested torque/i, /torque desired/i] },
  { canonical: "torque.actual", patterns: [/torque actual/i, /actual torque/i, /engine torque(?!.*request)/i] },
  { canonical: "torque.limit", patterns: [/torque limit(?!ation state)/i] },
  { canonical: "torque.state", patterns: [/torque limitation state/i, /torque intervention/i] },
  { canonical: "fuel.high.target", patterns: [/(?:high pressure|hpfp|rail).*fuel.*target/i, /fuel pressure.*target/i] },
  { canonical: "fuel.high.actual", patterns: [/(?:high pressure|hpfp|rail).*fuel.*actual/i, /fuel pressure actual/i, /^fuel pressure(?:\s|$|\()/i] },
  { canonical: "fuel.low.actual", patterns: [/(?:low pressure|lpfp).*fuel/i] },
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
  { canonical: "transmission.tccSlip", patterns: [/tcc.*slip/i, /converter.*slip/i, /lockup.*slip/i] },
  { canonical: "transmission.gear", patterns: [/^gear(?:\s|$|\()/i, /current gear/i] },
  { canonical: "vehicle.speed", patterns: [/vehicle speed/i, /^speed(?:\s|$|\()/i] },
  { canonical: "ignition.total", patterns: [/ignition timing total/i, /^ignition timing(?!.*cyl)/i, /ignition retard(?!.*cyl)/i] },
];

const GROUPS: Array<{ prefix: string; pattern: RegExp }> = [
  { prefix: "ignition.cylinder", pattern: /ignition.*(?:cylinder|cyl)\s*(\d+)/i },
  { prefix: "knock.cylinder", pattern: /knock.*(?:retard)?.*(?:cylinder|cyl)\s*(\d+)/i },
  { prefix: "wheel.speed", pattern: /wheel speed\s*(fl|fr|rl|rr|front left|front right|rear left|rear right)/i },
];

export interface ResolvedChannels { mapping: Map<string, SemanticChannelMatch>; groups: Map<string, SemanticChannelMatch[]>; matches: SemanticChannelMatch[]; }

export function resolveChannels(channels: ChannelMetadata[]): ResolvedChannels {
  const mapping = new Map<string, SemanticChannelMatch>();
  const groups = new Map<string, SemanticChannelMatch[]>();
  const matches: SemanticChannelMatch[] = [];
  for (const channel of channels) {
    for (const definition of ALIASES) {
      const patternIndex = definition.patterns.findIndex((pattern) => pattern.test(channel.name));
      if (patternIndex < 0 || mapping.has(definition.canonical)) continue;
      const confidence = patternIndex === 0 ? 0.96 : Math.max(0.68, 0.9 - patternIndex * 0.06);
      const match = { canonical: definition.canonical, channelId: channel.id, channelName: channel.name, confidence, confirmed: confidence >= 0.9 };
      mapping.set(definition.canonical, match); matches.push(match);
    }
    for (const definition of GROUPS) {
      const matchResult = channel.name.match(definition.pattern);
      if (!matchResult) continue;
      const canonical = `${definition.prefix}.${matchResult[1].toLowerCase().replace(/\s+/g, "-")}`;
      const match = { canonical, channelId: channel.id, channelName: channel.name, confidence: 0.95, confirmed: true };
      groups.set(definition.prefix, [...(groups.get(definition.prefix) ?? []), match]); matches.push(match);
    }
  }
  return { mapping, groups, matches };
}
