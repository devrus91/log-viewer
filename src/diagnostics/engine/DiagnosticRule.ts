import type { ChannelMetadata, DetectedPull, DiagnosticConfidence, DiagnosticProfile, DiagnosticSeverity, SemanticChannelMatch } from "@/domain/types";

export interface DiagnosticDataset {
  channels: ChannelMetadata[];
  columns: Record<string, Float64Array>;
  time: Float64Array;
  mapping: Map<string, SemanticChannelMatch>;
  groups: Map<string, SemanticChannelMatch[]>;
  profile: DiagnosticProfile;
  pulls: DetectedPull[];
}

export interface EventDraft {
  startIndex: number;
  endIndex: number;
  peakIndex: number;
  severity?: DiagnosticSeverity;
  confidence?: DiagnosticConfidence;
  message: string;
  values?: Record<string, number | string>;
  relatedChannels?: string[];
  occurrences?: number;
}
