import type { ChannelMappingOverride, ChannelMetadata } from "@/domain/types";

export const CHANNEL_MAPPING_OVERRIDES_KEY = "automotive-log-viewer.channel-mapping-overrides";

export function normalizeChannelName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function loadChannelMappingOverrides(storage: Storage = window.localStorage): ChannelMappingOverride[] {
  try {
    const parsed = JSON.parse(storage.getItem(CHANNEL_MAPPING_OVERRIDES_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ChannelMappingOverride => Boolean(item)
      && typeof item.canonical === "string"
      && typeof item.channelName === "string"
      && typeof item.updatedAt === "number");
  } catch {
    return [];
  }
}

export function saveOverridesForChannels(channels: ChannelMetadata[], replacements: ChannelMappingOverride[], storage: Storage = window.localStorage): ChannelMappingOverride[] {
  const currentNames = new Set(channels.flatMap((channel) => [normalizeChannelName(channel.name), normalizeChannelName(channel.originalName)]));
  const preserved = loadChannelMappingOverrides(storage).filter((override) => !currentNames.has(normalizeChannelName(override.channelName)));
  const result = [...preserved, ...replacements];
  storage.setItem(CHANNEL_MAPPING_OVERRIDES_KEY, JSON.stringify(result));
  return result;
}
