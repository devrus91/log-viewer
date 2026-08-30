import type { DetectedPull, DiagnosticRuleConfig, DiagnosticSeverity, SemanticChannelMatch } from "@/domain/types";

interface PullInput {
  columns: Record<string, Float64Array>;
  mapping: Map<string, SemanticChannelMatch>;
  time: Float64Array;
  rule: DiagnosticRuleConfig;
}

function value(input: PullInput, canonical: string): Float64Array | undefined {
  const id = input.mapping.get(canonical)?.channelId;
  return id ? input.columns[id] : undefined;
}

function finiteMax(values: Float64Array | undefined, start: number, end: number): number | null {
  if (!values) return null;
  let result = -Infinity;
  for (let index = start; index <= end; index += 1) if (Number.isFinite(values[index])) result = Math.max(result, values[index]);
  return result === -Infinity ? null : result;
}

function finiteMin(values: Float64Array | undefined, start: number, end: number): number | null {
  if (!values) return null;
  let result = Infinity;
  for (let index = start; index <= end; index += 1) if (Number.isFinite(values[index])) result = Math.min(result, values[index]);
  return result === Infinity ? null : result;
}

export function detectPulls(input: PullInput): DetectedPull[] {
  const rpm = value(input, "engine.rpm");
  const throttle = value(input, "driver.pedal") ?? value(input, "throttle.actual");
  if (!rpm || !throttle) return [];
  const minimumThrottle = input.rule.parameters.MIN_THROTTLE;
  const minimumDuration = input.rule.parameters.MIN_DURATION_MS;
  const minimumRpmGain = input.rule.parameters.MIN_RPM_GAIN;
  if (minimumThrottle === undefined || minimumDuration === undefined || minimumRpmGain === undefined) return [];
  const boost = value(input, "boost.actual");
  const lambda = value(input, "lambda.actual");
  const torque = value(input, "torque.actual");
  const iat = value(input, "temperature.iat");
  const gear = value(input, "transmission.gear");
  const pulls: DetectedPull[] = [];
  let start = -1;
  for (let index = 0; index <= input.time.length; index += 1) {
    const active = index < input.time.length && throttle[index] >= minimumThrottle && Number.isFinite(rpm[index]);
    if (active && start < 0) start = index;
    if (active || start < 0) continue;
    const end = index - 1;
    const durationMs = (input.time[end] - input.time[start]) * 1000;
    const rpmGain = rpm[end] - rpm[start];
    if (durationMs >= minimumDuration && rpmGain >= minimumRpmGain) {
      const gears = gear ? Array.from(new Set(Array.from(gear.slice(start, end + 1)).filter((item) => Number.isFinite(item) && item > 0).map(Math.round))) : [];
      pulls.push({ id: `pull-${pulls.length + 1}`, startTime: input.time[start], endTime: input.time[end], startIndex: start, endIndex: end, startRpm: rpm[start], endRpm: rpm[end], peakBoost: finiteMax(boost, start, end), minimumLambda: finiteMin(lambda, start, end), peakTorque: finiteMax(torque, start, end), startIat: iat && Number.isFinite(iat[start]) ? iat[start] : null, endIat: iat && Number.isFinite(iat[end]) ? iat[end] : null, gears, severity: "info" as DiagnosticSeverity });
    }
    start = -1;
  }
  return pulls;
}
