import type { DiagnosticProfile, DiagnosticRuleConfig, StoredDiagnosticProfiles } from "@/domain/types";
import { createDefaultDiagnosticRules, DEFAULT_RULES_VERSION, DIAGNOSTIC_SCHEMA_VERSION } from "@/diagnostics/defaults/defaultRules";
import type { DiagnosticRuleRepository } from "./DiagnosticRuleRepository";

export const DIAGNOSTIC_PROFILES_KEY = "automotive-log-viewer.diagnostic-profiles";
export const ACTIVE_DIAGNOSTIC_PROFILE_KEY = "automotive-log-viewer.active-diagnostic-profile";

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function defaultProfile(): DiagnosticProfile { return { id: "default", name: "Default / Generic Vehicle", vehicleSpecific: false, origin: "default", rules: createDefaultDiagnosticRules() }; }

export function migrateDiagnosticProfiles(stored: StoredDiagnosticProfiles): StoredDiagnosticProfiles {
  const defaults = createDefaultDiagnosticRules();
  const defaultsById = new Map(defaults.map((rule) => [rule.id, rule]));
  const profiles = stored.profiles.map((profile) => {
    const rules = profile.rules.map((storedRule) => ({
      ...storedRule,
      wotOnly: storedRule.wotOnly ?? defaultsById.get(storedRule.id)?.wotOnly ?? (storedRule.detector !== "pull"),
    }));
    for (const defaultRule of defaults) if (!rules.some((rule) => rule.id === defaultRule.id)) rules.push(clone(defaultRule));
    return { ...profile, rules };
  });
  if (!profiles.some((profile) => profile.id === "default")) profiles.unshift(defaultProfile());
  return { schemaVersion: DIAGNOSTIC_SCHEMA_VERSION, rulesVersion: DEFAULT_RULES_VERSION, profiles };
}

export class LocalStorageDiagnosticRuleRepository implements DiagnosticRuleRepository {
  constructor(private readonly storage: Storage) {}

  private read(): StoredDiagnosticProfiles | null {
    try { const raw = this.storage.getItem(DIAGNOSTIC_PROFILES_KEY); return raw ? JSON.parse(raw) as StoredDiagnosticProfiles : null; }
    catch { return null; }
  }

  private write(profiles: DiagnosticProfile[]): void {
    const payload: StoredDiagnosticProfiles = { schemaVersion: DIAGNOSTIC_SCHEMA_VERSION, rulesVersion: DEFAULT_RULES_VERSION, profiles };
    this.storage.setItem(DIAGNOSTIC_PROFILES_KEY, JSON.stringify(payload));
  }

  initializeDiagnosticRules(): DiagnosticProfile[] {
    const stored = this.read();
    if (!stored) { const profiles = [defaultProfile()]; this.write(profiles); if (!this.storage.getItem(ACTIVE_DIAGNOSTIC_PROFILE_KEY)) this.setActiveProfileId("default"); return profiles; }
    const migrated = migrateDiagnosticProfiles(stored); this.write(migrated.profiles); return migrated.profiles;
  }

  loadProfiles(): DiagnosticProfile[] { return this.initializeDiagnosticRules(); }
  saveProfile(profile: DiagnosticProfile): void { const profiles = this.initializeDiagnosticRules(); const next = profiles.some((item) => item.id === profile.id) ? profiles.map((item) => item.id === profile.id ? clone(profile) : item) : [...profiles, clone(profile)]; this.write(next); }
  deleteProfile(id: string): void { if (id === "default") return; const profiles = this.initializeDiagnosticRules().filter((profile) => profile.id !== id); this.write(profiles); if (this.getActiveProfileId() === id) this.setActiveProfileId("default"); }
  getActiveProfileId(): string { return this.storage.getItem(ACTIVE_DIAGNOSTIC_PROFILE_KEY) ?? "default"; }
  setActiveProfileId(id: string): void { this.storage.setItem(ACTIVE_DIAGNOSTIC_PROFILE_KEY, id); }

  resetRule(profileId: string, ruleId: string): DiagnosticRuleConfig | null {
    const profile = this.initializeDiagnosticRules().find((item) => item.id === profileId); const defaultRule = createDefaultDiagnosticRules().find((rule) => rule.id === ruleId); if (!profile || !defaultRule) return null;
    profile.rules = profile.rules.map((rule) => rule.id === ruleId ? clone(defaultRule) : rule); this.saveProfile(profile); return defaultRule;
  }

  resetAllBuiltInRules(profileId: string): DiagnosticProfile | null {
    const profile = this.initializeDiagnosticRules().find((item) => item.id === profileId); if (!profile) return null;
    const custom = profile.rules.filter((rule) => rule.origin === "user"); profile.rules = [...createDefaultDiagnosticRules(), ...custom]; this.saveProfile(profile); return profile;
  }
}

export function createDiagnosticRuleRepository(): LocalStorageDiagnosticRuleRepository {
  if (typeof window === "undefined") throw new Error("Diagnostic rule repository is only available in the browser");
  return new LocalStorageDiagnosticRuleRepository(window.localStorage);
}

export function getActiveDiagnosticProfile(repository: DiagnosticRuleRepository): DiagnosticProfile {
  const profiles = repository.initializeDiagnosticRules(); const activeId = repository.getActiveProfileId(); return profiles.find((profile) => profile.id === activeId) ?? profiles[0];
}
