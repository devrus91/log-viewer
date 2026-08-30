import type { DiagnosticProfile, DiagnosticRuleConfig } from "@/domain/types";

export interface DiagnosticRuleRepository {
  loadProfiles(): DiagnosticProfile[];
  saveProfile(profile: DiagnosticProfile): void;
  deleteProfile(id: string): void;
  getActiveProfileId(): string;
  setActiveProfileId(id: string): void;
  initializeDiagnosticRules(): DiagnosticProfile[];
  resetRule(profileId: string, ruleId: string): DiagnosticRuleConfig | null;
  resetAllBuiltInRules(profileId: string): DiagnosticProfile | null;
}
