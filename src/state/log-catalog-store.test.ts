import { describe, expect, it } from "vitest";
import { buildLogCatalog } from "./log-catalog-store";

function folderFile(name: string, relativePath: string, size = 4): File {
  const file = new File(["test"], name, { type: "text/csv", lastModified: 10 });
  Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("folder log catalog", () => {
  it("keeps CSV logs from nested folders and sorts them naturally", () => {
    const result = buildLogCatalog([
      folderFile("log10.csv", "session/sub/log10.csv"),
      folderFile("notes.txt", "session/notes.txt"),
      folderFile("log2.CSV", "session/log2.CSV"),
    ]);

    expect(result.folderName).toBe("session");
    expect(result.entries.map((entry) => entry.relativePath)).toEqual(["session/log2.CSV", "session/sub/log10.csv"]);
  });

  it("returns an empty catalog when the folder has no CSV logs", () => {
    expect(buildLogCatalog([folderFile("notes.txt", "session/notes.txt")]).entries).toEqual([]);
  });
});
