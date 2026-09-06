import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelMappingOverride, ChannelMetadata } from "@/domain/types";
import { useWorkspaceStore } from "@/state/workspace-store";
import { ChannelMappingManager } from "./ChannelMappingManager";

const channels: ChannelMetadata[] = [
  { id: "rpm", name: "Engine Speed (rpm)", originalName: "Engine Speed (rpm)", unit: "rpm", group: "Engine", type: "number", min: 1000, max: 5000, average: 3000, sampleCount: 2, color: "#4dd7ff" },
  { id: "calc-boost-error", name: "Boost Error", originalName: "Boost Error", unit: "bar", group: "Calculated", type: "calculated", min: 0, max: 1, average: 0.5, sampleCount: 2, color: "#f472b6", expression: "[Boost Target] - [Boost Actual]" },
];

describe("ChannelMappingManager", () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkspaceStore.setState({ channels });
  });

  it("allows a calculated channel to be mapped for diagnostics", async () => {
    const onApply = vi.fn<(overrides: ChannelMappingOverride[]) => Promise<void>>().mockResolvedValue(undefined);
    render(<ChannelMappingManager open onClose={vi.fn()} onApply={onApply} />);

    expect(screen.getByText("Boost Error")).toBeTruthy();
    expect(screen.getByText("bar · CALCULATED")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Manual canonical mapping for Boost Error"), { target: { value: "boost.actual" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and re-run diagnostics" }));

    await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(onApply.mock.calls[0][0]).toEqual(expect.arrayContaining([expect.objectContaining({ canonical: "boost.actual", channelName: "Boost Error" })]));
  });
});
