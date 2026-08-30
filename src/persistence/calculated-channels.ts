import type { CalculatedChannelDefinition } from "@/domain/types";

export const CALCULATED_CHANNELS_KEY = "automotive-log-viewer.calculated-channels";
export const CALCULATED_CHANNELS_SCHEMA_VERSION = 1;

interface StoredCalculatedChannels {
  schemaVersion: number;
  definitions: CalculatedChannelDefinition[];
}

function validDefinition(value: unknown): value is CalculatedChannelDefinition {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CalculatedChannelDefinition>;
  return typeof item.id === "string" && Boolean(item.id) && typeof item.name === "string" && Boolean(item.name) && typeof item.unit === "string" && typeof item.expression === "string" && Boolean(item.expression) && typeof item.color === "string" && typeof item.createdAt === "number" && Number.isFinite(item.createdAt) && Boolean(item.parameters) && typeof item.parameters === "object" && !Array.isArray(item.parameters) && Object.values(item.parameters).every((parameter) => typeof parameter === "number" && Number.isFinite(parameter));
}

export function loadCalculatedChannelDefinitions(storage: Storage = window.localStorage): CalculatedChannelDefinition[] {
  try {
    const raw = storage.getItem(CALCULATED_CHANNELS_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw) as Partial<StoredCalculatedChannels>;
    if (stored.schemaVersion !== CALCULATED_CHANNELS_SCHEMA_VERSION || !Array.isArray(stored.definitions)) return [];
    return stored.definitions.filter(validDefinition).map((definition) => structuredClone(definition));
  } catch { return []; }
}

export function saveCalculatedChannelDefinition(definition: CalculatedChannelDefinition, storage: Storage = window.localStorage): CalculatedChannelDefinition {
  const definitions = loadCalculatedChannelDefinitions(storage);
  const existing = definitions.find((item) => item.id === definition.id) ?? definitions.find((item) => item.name.toLocaleLowerCase() === definition.name.toLocaleLowerCase());
  const saved = { ...structuredClone(definition), id: existing?.id ?? definition.id, createdAt: existing?.createdAt ?? definition.createdAt };
  const next = existing ? definitions.map((item) => {
    if (item.id === existing.id) return saved;
    return existing.name === saved.name ? item : { ...item, expression: replaceChannelReference(item.expression, existing.name, saved.name) };
  }) : [...definitions, saved];
  const payload: StoredCalculatedChannels = { schemaVersion: CALCULATED_CHANNELS_SCHEMA_VERSION, definitions: next };
  storage.setItem(CALCULATED_CHANNELS_KEY, JSON.stringify(payload));
  return structuredClone(saved);
}

function replaceChannelReference(expression: string, previousName: string, nextName: string): string {
  const escaped = previousName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return expression.replace(new RegExp(`\\[\\s*${escaped}\\s*\\]`, "g"), `[${nextName}]`);
}
