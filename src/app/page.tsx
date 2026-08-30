"use client";

import { ImportScreen } from "@/components/ImportScreen";
import { LogWorkspace } from "@/components/LogWorkspace";
import { useWorkspaceStore } from "@/state/workspace-store";

export default function Home() {
  const metadata = useWorkspaceStore((state) => state.metadata);
  return metadata ? <LogWorkspace /> : <ImportScreen />;
}
