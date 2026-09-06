"use client";

import { useMemo, useState } from "react";
import { Link2, RotateCcw, Search, X } from "lucide-react";
import { AccessibleDialog } from "@/components/AccessibleDialog";
import type { ChannelMappingOverride } from "@/domain/types";
import { loadChannelMappingOverrides, normalizeChannelName, saveOverridesForChannels } from "@/diagnostics/persistence/channel-mappings";
import { resolveChannels, SEMANTIC_CHANNEL_IDS } from "@/diagnostics/semanticMapping/ChannelResolver";
import { useWorkspaceStore } from "@/state/workspace-store";

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (overrides: ChannelMappingOverride[]) => Promise<void>;
}

const GROUP_CHANNEL_IDS = [
  ...["fl", "fr", "rl", "rr"].map((position) => `wheel.speed.${position}`),
  ...Array.from({ length: 8 }, (_, index) => `ignition.cylinder.${index + 1}`),
  ...Array.from({ length: 8 }, (_, index) => `knock.cylinder.${index + 1}`),
];
const CANONICAL_PATTERN = /^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)*$/i;

export function ChannelMappingManager({ open, onClose, onApply }: Props) {
  if (!open) return null;
  return <OpenChannelMappingManager onClose={onClose} onApply={onApply} />;
}

function OpenChannelMappingManager({ onClose, onApply }: Omit<Props, "open">) {
  const channels = useWorkspaceStore((state) => state.channels).filter((channel) => channel.type !== "calculated");
  const [query, setQuery] = useState("");
  const [saved] = useState<ChannelMappingOverride[]>(() => loadChannelMappingOverrides());
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const channel of channels) {
      const names = new Set([normalizeChannelName(channel.name), normalizeChannelName(channel.originalName)]);
      const override = saved.filter((item) => names.has(normalizeChannelName(item.channelName))).sort((left, right) => right.updatedAt - left.updatedAt)[0];
      if (override) next[channel.id] = override.canonical;
    }
    return next;
  });
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const automatic = useMemo(() => resolveChannels(channels), [channels]);
  const automaticByChannel = useMemo(() => {
    const result = new Map<string, string[]>();
    automatic.matches.forEach((match) => result.set(match.channelId, [...(result.get(match.channelId) ?? []), match.canonical]));
    return result;
  }, [automatic]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleChannels = channels.filter((channel) => !normalizedQuery
    || channel.name.toLocaleLowerCase().includes(normalizedQuery)
    || (drafts[channel.id] ?? "").toLocaleLowerCase().includes(normalizedQuery)
    || (automaticByChannel.get(channel.id) ?? []).some((canonical) => canonical.includes(normalizedQuery)));
  const knownCanonicals = Array.from(new Set([
    ...SEMANTIC_CHANNEL_IDS,
    ...GROUP_CHANNEL_IDS,
    ...automatic.matches.map((match) => match.canonical),
    ...saved.map((override) => override.canonical),
  ])).sort();
  const currentNames = new Set(channels.flatMap((channel) => [normalizeChannelName(channel.name), normalizeChannelName(channel.originalName)]));
  const historicalCount = saved.filter((override) => !currentNames.has(normalizeChannelName(override.channelName))).length;
  const overrideCount = Object.values(drafts).filter((value) => value.trim()).length;

  const save = async () => {
    const replacements = channels.flatMap((channel, index) => {
      const canonical = (drafts[channel.id] ?? "").trim();
      return canonical ? [{ canonical, channelName: channel.name, updatedAt: Date.now() + index }] : [];
    });
    const invalid = replacements.find((override) => !CANONICAL_PATTERN.test(override.canonical));
    if (invalid) { setError(`Invalid canonical name: ${invalid.canonical}`); return; }
    const duplicate = replacements.find((override, index) => replacements.findIndex((item) => item.canonical === override.canonical) !== index);
    if (duplicate) { setError(`Canonical ${duplicate.canonical} is assigned to more than one channel in this log.`); return; }
    setApplying(true);
    setError("");
    try {
      const result = saveOverridesForChannels(channels, replacements);
      await onApply(result);
      onClose();
    } catch {
      setError("Could not apply channel mappings.");
    } finally {
      setApplying(false);
    }
  };

  return <AccessibleDialog className="mapping-modal" ariaLabelledBy="channel-mapping-title" onClose={onClose}>
    <header><div><span className="eyebrow">SEMANTIC CHANNELS</span><h2 id="channel-mapping-title">Channel Mapping</h2><p>Manual mappings override automatic detection and are reused for matching channel names in future logs.</p></div><button aria-label="Close channel mapping" onClick={onClose}><X size={18} /></button></header>
    <div className="mapping-toolbar"><label><Search size={14} /><input aria-label="Search channels and mappings" placeholder="Search raw or canonical channel" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span><b>{automatic.matches.length}</b> automatic · <b>{overrideCount}</b> manual{historicalCount ? ` · ${historicalCount} saved for other logs` : ""}</span><button className="button secondary" type="button" disabled={!overrideCount} onClick={() => { setDrafts({}); setError(""); }}><RotateCcw size={13} /> Clear current overrides</button></div>
    <div className="mapping-head"><span>Source channel</span><span>Automatic result</span><span>Manual override</span></div>
    <div className="mapping-list">{visibleChannels.map((channel) => {
      const auto = automaticByChannel.get(channel.id) ?? [];
      const manual = drafts[channel.id] ?? "";
      return <div className={manual ? "manual" : ""} key={channel.id}><span><i style={{ background: channel.color }} /><b title={channel.name}>{channel.name}</b><small>{channel.unit}</small></span><code>{auto.length ? auto.join(", ") : "—"}</code><label><Link2 size={12} /><input aria-label={`Manual canonical mapping for ${channel.name}`} list="semantic-channel-options" placeholder={auto.length ? "Use automatic" : "canonical.name"} value={manual} onChange={(event) => { setDrafts((current) => ({ ...current, [channel.id]: event.target.value })); setError(""); }} />{manual && <button type="button" aria-label={`Clear manual mapping for ${channel.name}`} onClick={() => setDrafts((current) => ({ ...current, [channel.id]: "" }))}><X size={12} /></button>}</label></div>;
    })}{visibleChannels.length === 0 && <div className="mapping-empty">No matching channels</div>}</div>
    <datalist id="semantic-channel-options">{knownCanonicals.map((canonical) => <option value={canonical} key={canonical} />)}</datalist>
    <footer><span>{error || "An empty override keeps the automatic result."}</span><div><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={applying} onClick={() => void save()}>{applying ? "Applying…" : "Save and re-run diagnostics"}</button></div></footer>
  </AccessibleDialog>;
}
