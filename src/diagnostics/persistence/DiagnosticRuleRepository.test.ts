import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultDiagnosticRules, DEFAULT_RULES_VERSION, DIAGNOSTIC_SCHEMA_VERSION } from "@/diagnostics/defaults/defaultRules";
import { ACTIVE_DIAGNOSTIC_PROFILE_KEY, DIAGNOSTIC_PROFILES_KEY, LocalStorageDiagnosticRuleRepository } from "./LocalStorageDiagnosticRuleRepository";

describe("diagnostic rule repository", () => {
  beforeEach(() => localStorage.clear());

  it("seeds defaults once and preserves user modifications", () => {
    const repository = new LocalStorageDiagnosticRuleRepository(localStorage);
    const profiles = repository.initializeDiagnosticRules();
    expect(profiles[0].rules).toHaveLength(26);
    profiles[0].rules[0].parameters.BOOST_ERROR_WARNING = .17;
    profiles[0].rules[0].modified = true;
    repository.saveProfile(profiles[0]);
    expect(repository.initializeDiagnosticRules()[0].rules[0].parameters.BOOST_ERROR_WARNING).toBe(.17);
    expect(JSON.parse(localStorage.getItem(DIAGNOSTIC_PROFILES_KEY)!).schemaVersion).toBe(DIAGNOSTIC_SCHEMA_VERSION);
  });

  it("migrates by stable id and adds new defaults without overwriting existing rules", () => {
    const customized = createDefaultDiagnosticRules()[0]; customized.parameters.BOOST_ERROR_WARNING = .11; customized.modified = true;
    localStorage.setItem(DIAGNOSTIC_PROFILES_KEY, JSON.stringify({ schemaVersion: 1, rulesVersion: 0, profiles: [{ id: "default", name: "Default", vehicleSpecific: false, origin: "default", rules: [customized] }] }));
    const repository = new LocalStorageDiagnosticRuleRepository(localStorage);
    const profile = repository.initializeDiagnosticRules()[0];
    expect(profile.rules).toHaveLength(26);
    expect(profile.rules.find((rule) => rule.id === customized.id)?.parameters.BOOST_ERROR_WARNING).toBe(.11);
    expect(JSON.parse(localStorage.getItem(DIAGNOSTIC_PROFILES_KEY)!).rulesVersion).toBe(DEFAULT_RULES_VERSION);
  });

  it("resets built-ins but keeps custom rules and persists active profile", () => {
    const repository = new LocalStorageDiagnosticRuleRepository(localStorage); const profile = repository.initializeDiagnosticRules()[0];
    profile.rules.push({ ...structuredClone(profile.rules[0]), id: "custom-check", origin: "user", name: "Custom check" }); repository.saveProfile(profile);
    profile.rules[0].parameters.BOOST_ERROR_WARNING = .01; profile.rules[0].modified = true; repository.saveProfile(profile);
    const reset = repository.resetAllBuiltInRules("default")!;
    expect(reset.rules.some((rule) => rule.id === "custom-check")).toBe(true);
    expect(reset.rules[0].modified).toBe(false);
    repository.setActiveProfileId("default");
    expect(localStorage.getItem(ACTIVE_DIAGNOSTIC_PROFILE_KEY)).toBe("default");
  });
});
