import { create } from "zustand";

export interface LogCatalogEntry {
  id: string;
  file: File;
  relativePath: string;
}

interface LogCatalogState {
  folderName: string;
  entries: LogCatalogEntry[];
  setFolderFiles: (files: File[]) => void;
  clearFolder: () => void;
}

export function buildLogCatalog(files: File[]): { folderName: string; entries: LogCatalogEntry[] } {
  const entries = files
    .filter((file) => file.name.toLocaleLowerCase().endsWith(".csv"))
    .map((file) => {
      const relativePath = file.webkitRelativePath || file.name;
      return { id: `${relativePath}:${file.size}:${file.lastModified}`, file, relativePath };
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath, undefined, { numeric: true, sensitivity: "base" }));
  const firstPath = entries[0]?.relativePath ?? files[0]?.webkitRelativePath ?? "";
  const folderName = firstPath.includes("/") ? firstPath.split("/")[0] : files.length ? "Selected folder" : "";
  return { folderName, entries };
}

export const useLogCatalogStore = create<LogCatalogState>((set) => ({
  folderName: "",
  entries: [],
  setFolderFiles: (files) => set(buildLogCatalog(files)),
  clearFolder: () => set({ folderName: "", entries: [] }),
}));
