import type { DiagnosticProfile } from "@/domain/types";
import { createDefaultDiagnosticRules } from "@/diagnostics/defaults/defaultRules";

export const defaultDiagnosticProfile: DiagnosticProfile = {
  id: "default",
  name: "Default / Generic Vehicle",
  vehicleSpecific: false,
  origin: "default",
  rules: createDefaultDiagnosticRules(),
};
