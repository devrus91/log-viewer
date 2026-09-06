import { beforeEach, describe, expect, it } from "vitest";
import type { ChannelMetadata, DiagnosticEvent, LogMetadata } from "@/domain/types";
import { useWorkspaceStore } from "./workspace-store";

describe("workspace diagnostic focus", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useWorkspaceStore.setState({
      channels: [{ id: "existing" }, { id: "related" }] as ChannelMetadata[],
      selectedChannelIds: ["existing"],
      activeChannelId: "existing",
      nearestChannelFocusEnabled: true,
      metadata: { rows: 100, averageSampleRate: 10 } as LogMetadata,
      range: [10, 80],
    });
  });

  it("adds related channels without replacing the current selection", () => {
    useWorkspaceStore.getState().focusDiagnostic({
      id: "issue-1",
      relatedChannels: ["related", "existing", "missing"],
      startIndex: 30,
      endIndex: 40,
      peakIndex: 35,
    } as DiagnosticEvent);

    const state = useWorkspaceStore.getState();
    expect(state.selectedChannelIds).toEqual(["existing", "related"]);
    expect(state.activeChannelId).toBe("related");
    expect(state.range).toEqual([10, 80]);
    expect(state.cursorIndex).toBe(35);
  });

  it("persists the nearest-channel focus preference", () => {
    useWorkspaceStore.getState().setNearestChannelFocusEnabled(false);

    expect(useWorkspaceStore.getState().nearestChannelFocusEnabled).toBe(false);
    expect(useWorkspaceStore.getState().activeChannelId).toBeNull();
    expect(window.localStorage.getItem("automotive-log-viewer.nearest-channel-focus")).toBe("false");
  });

  it("toggles channel selection without focusing a row when focus is disabled", () => {
    useWorkspaceStore.getState().setNearestChannelFocusEnabled(false);
    useWorkspaceStore.getState().toggleChannel("related");

    const state = useWorkspaceStore.getState();
    expect(state.selectedChannelIds).toEqual(["existing", "related"]);
    expect(state.activeChannelId).toBeNull();
  });

  it("hydrates valid chart preferences and ignores invalid values", () => {
    window.localStorage.setItem("automotive-log-viewer.chart-text-size", "large");
    window.localStorage.setItem("automotive-log-viewer.grid-visibility", "invalid");
    window.localStorage.setItem("automotive-log-viewer.wheel-zoom-mode", "modifier");

    useWorkspaceStore.getState().hydratePreferences(window.localStorage);

    expect(useWorkspaceStore.getState().chartTextSize).toBe("large");
    expect(useWorkspaceStore.getState().gridVisibility).toBe("standard");
    expect(useWorkspaceStore.getState().wheelZoomMode).toBe("modifier");
  });

  it("pins tooltip channels and removes their pin when deselected", () => {
    useWorkspaceStore.getState().toggleTooltipPinnedChannel("existing");
    expect(useWorkspaceStore.getState().pinnedTooltipChannelIds).toEqual(["existing"]);

    useWorkspaceStore.getState().toggleChannel("existing");
    expect(useWorkspaceStore.getState().pinnedTooltipChannelIds).toEqual([]);
  });
});
