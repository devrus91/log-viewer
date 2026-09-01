import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "@/state/workspace-store";
import { WorkspaceSettings } from "./WorkspaceSettings";

describe("WorkspaceSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useWorkspaceStore.setState({ valueDisplayMode: "panel", chartTextSize: "standard", nearestChannelFocusEnabled: true });
  });

  it("organizes chart preferences into keyboard-accessible tabs", () => {
    render(<WorkspaceSettings open onClose={vi.fn()} onOpenDiagnosticRules={vi.fn()} />);
    const display = screen.getByRole("tab", { name: "Display" });
    const cursor = screen.getByRole("tab", { name: "Cursor & tooltip" });
    expect(display.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(display, { key: "ArrowRight" });
    expect(cursor.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Cursor and tooltip")).toBeTruthy();
  });

  it("reveals tooltip-specific settings progressively", () => {
    render(<WorkspaceSettings open onClose={vi.fn()} onOpenDiagnosticRules={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Cursor & tooltip" }));
    expect(screen.queryByText("Tooltip position")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Chart tooltip/ }));
    expect(screen.getByText("Tooltip position")).toBeTruthy();
    expect(screen.getByText("Tooltip contents")).toBeTruthy();
  });
});
