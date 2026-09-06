import { beforeEach, describe, expect, it } from "vitest";
import { parseCsv } from "@/data/csv";
import { CHANNEL_MAPPING_OVERRIDES_KEY, loadChannelMappingOverrides, saveOverridesForChannels } from "./channel-mappings";

describe("persisted channel mappings", () => {
  beforeEach(() => localStorage.clear());

  it("replaces mappings for the current source names and preserves mappings for other logs", () => {
    localStorage.setItem(CHANNEL_MAPPING_OVERRIDES_KEY, JSON.stringify([
      { canonical: "boost.actual", channelName: "Old boost", updatedAt: 1 },
      { canonical: "torque.request", channelName: "Torque Request", updatedAt: 2 },
    ]));
    const channels = parseCsv("Torque Request,Boost Actual\n1,2\n2,3").channels;
    const result = saveOverridesForChannels(channels, [{ canonical: "boost.actual", channelName: "Boost Actual", updatedAt: 3 }]);
    expect(result).toEqual([
      { canonical: "boost.actual", channelName: "Old boost", updatedAt: 1 },
      { canonical: "boost.actual", channelName: "Boost Actual", updatedAt: 3 },
    ]);
    expect(loadChannelMappingOverrides()).toEqual(result);
  });

  it("returns an empty collection for invalid storage data", () => {
    localStorage.setItem(CHANNEL_MAPPING_OVERRIDES_KEY, "not-json");
    expect(loadChannelMappingOverrides()).toEqual([]);
  });
});
