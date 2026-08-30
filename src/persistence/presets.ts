import { get, set } from "idb-keyval";
import type { ViewPreset } from "@/domain/types";

const KEY = "automotive-log-viewer-presets-v1";

export async function loadPresets(): Promise<ViewPreset[]> {
  try { return (await get<ViewPreset[]>(KEY)) ?? []; }
  catch { return []; }
}

export async function savePresets(presets: ViewPreset[]): Promise<void> {
  await set(KEY, presets);
}
