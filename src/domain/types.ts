export type WorkspaceMode = "single" | "split" | "heatmap" | "raw";
export type AxisMode = "shared" | "auto" | "independent";
export type Aggregation = "average" | "min" | "max" | "median" | "count" | "sum";

export interface ChannelMetadata {
  id: string;
  name: string;
  originalName: string;
  unit: string;
  group: string;
  type: "number" | "calculated";
  min: number;
  max: number;
  average: number;
  sampleCount: number;
  color: string;
  expression?: string;
}

export interface CalculatedChannelDefinition {
  id: string;
  name: string;
  unit: string;
  expression: string;
  parameters: Record<string, number>;
  color: string;
  createdAt: number;
}

export interface LogMetadata {
  id: string;
  filename: string;
  fileSize: number;
  rows: number;
  channels: number;
  timeChannelId: string;
  duration: number;
  averageSampleRate: number;
  minSampleInterval: number;
  maxSampleInterval: number;
  irregularSampling: boolean;
}

export interface DatasetTransfer {
  metadata: LogMetadata;
  channels: ChannelMetadata[];
  columns: Record<string, Float64Array>;
  analysis?: DiagnosticAnalysis;
}

export type DiagnosticSeverity = "critical" | "warning" | "info";
export type DiagnosticConfidence = "high" | "medium" | "low";
export type DiagnosticCategory = "Boost" | "Fuel" | "Ignition" | "Knock" | "Torque" | "Transmission" | "Temperature" | "Sensors" | "Wheel Speed" | "Engine";

export interface SemanticChannelMatch {
  canonical: string;
  channelId: string;
  channelName: string;
  confidence: number;
  confirmed: boolean;
}

export interface DiagnosticEvent {
  id: string;
  ruleId: string;
  name: string;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  startTime: number;
  endTime: number;
  peakTime: number;
  startIndex: number;
  endIndex: number;
  peakIndex: number;
  rpmStart: number | null;
  rpmEnd: number | null;
  peakRpm: number | null;
  values: Record<string, number | string>;
  message: string;
  confidence: DiagnosticConfidence;
  possibleCauses: string[];
  relatedChannels: string[];
  occurrences: number;
  correlatedEventIds: string[];
}

export interface DetectedPull {
  id: string;
  startTime: number;
  endTime: number;
  startIndex: number;
  endIndex: number;
  startRpm: number;
  endRpm: number;
  peakBoost: number | null;
  minimumLambda: number | null;
  peakTorque: number | null;
  startIat: number | null;
  endIat: number | null;
  gears: number[];
  severity: DiagnosticSeverity;
}

export type DiagnosticDetectorType = "temporal" | "rate" | "sudden-drop" | "group-temporal" | "cylinder-deviation" | "repeated-group" | "wheel-mismatch" | "wheel-spike" | "dropout" | "impossible-rate" | "stuck" | "gear-shift" | "pull";

export interface DiagnosticCondition {
  left: string;
  operator: "<" | "<=" | ">" | ">=" | "==" | "!=";
  right: string;
}

export interface DiagnosticRuleConfig {
  id: string;
  name: string;
  category: DiagnosticCategory;
  enabled: boolean;
  wotOnly: boolean;
  severity: DiagnosticSeverity;
  origin: "default" | "user";
  modified: boolean;
  detector: DiagnosticDetectorType;
  conditions: DiagnosticCondition[];
  parameters: Record<string, number>;
  durationMs: number;
  cooldownMs: number;
  correlationWindowMs: number;
  recommendedChannels: string[];
  message: string;
  possibleCauses: string[];
  detectorOptions: Record<string, string | number | boolean | string[]>;
  criticalCondition?: DiagnosticCondition;
}

export interface DiagnosticProfile {
  id: string;
  name: string;
  vehicleSpecific: boolean;
  origin: "default" | "user";
  rules: DiagnosticRuleConfig[];
}

export interface StoredDiagnosticProfiles {
  schemaVersion: number;
  rulesVersion: number;
  profiles: DiagnosticProfile[];
}

export interface DiagnosticAnalysis {
  events: DiagnosticEvent[];
  pulls: DetectedPull[];
  semanticMapping: SemanticChannelMatch[];
  counts: Record<DiagnosticSeverity, number>;
  health: "healthy" | "minor-warnings" | "attention-required" | "critical-events";
  score: number;
  profileId: string;
  completedAt: number;
}

export interface ChartPanelConfig {
  id: string;
  title: string;
  channelIds: string[];
  height: number;
  collapsed: boolean;
}

export interface HeatmapFilter {
  id: string;
  channelId: string;
  operator: "=" | "!=" | ">" | ">=" | "<" | "<=" | "between";
  value: number;
  value2?: number;
}

export interface HeatmapConfig {
  xChannelId: string;
  yChannelId: string;
  valueChannelId: string;
  xBins: number;
  yBins: number;
  aggregation: Aggregation;
  minSamples: number;
  filters: HeatmapFilter[];
}

export interface ViewPreset {
  id: string;
  name: string;
  mode: WorkspaceMode;
  selectedChannelIds: string[];
  panels: ChartPanelConfig[];
  xChannelId: string;
  range: [number, number];
  axisMode: AxisMode;
  heatmap: HeatmapConfig;
  createdAt: number;
}

export interface HeatmapCell {
  x: number;
  y: number;
  value: number;
  count: number;
}

export interface HeatmapResult {
  cells: HeatmapCell[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  valueMin: number;
  valueMax: number;
  xBins: number;
  yBins: number;
}
