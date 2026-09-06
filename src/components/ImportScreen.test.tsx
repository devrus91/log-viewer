import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLogCatalogStore } from "@/state/log-catalog-store";
import { ImportScreen } from "./ImportScreen";

function folderFile(name: string, relativePath: string, type = "text/csv"): File {
  const file = new File(["Time,Value\n0,1"], name, { type, lastModified: 10 });
  Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
  return file;
}

describe("ImportScreen folder catalog", () => {
  beforeEach(() => useLogCatalogStore.getState().clearFolder());

  it("shows CSV logs from the selected folder and filters them", () => {
    render(<ImportScreen />);
    expect(screen.getByRole("link", { name: "Documentation" }).getAttribute("href")).toBe("/docs");
    const input = screen.getByLabelText("Choose folder with CSV telemetry logs");

    fireEvent.change(input, { target: { files: [folderFile("warmup.csv", "dyno/warmup.csv"), folderFile("pull-2.csv", "dyno/session/pull-2.csv"), folderFile("notes.txt", "dyno/notes.txt", "text/plain")] } });

    expect(screen.getByText("dyno")).toBeTruthy();
    expect(screen.getByText("2 CSV logs")).toBeTruthy();
    expect(screen.getByText("warmup.csv")).toBeTruthy();
    expect(screen.getByText("pull-2.csv")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search folder logs"), { target: { value: "pull-2" } });
    expect(screen.queryByText("warmup.csv")).toBeNull();
    expect(screen.getByText("pull-2.csv")).toBeTruthy();
  });
});
