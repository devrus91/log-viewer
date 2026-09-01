type WotLabBrandProps = {
  compact?: boolean;
};

export function WotLabBrand({ compact = false }: WotLabBrandProps) {
  return (
    <div className={`wotlab-brand ${compact ? "compact" : ""}`}>
      <span className="wotlab-mark" aria-hidden="true">
        <svg viewBox="0 0 64 48" fill="none">
          <path className="trace trace-blue" d="M3 14h8l8 24 8-23 7 13" />
          <path className="trace trace-lime" d="M16 9l9 29L34 4l9 34L52 13" />
          <path className="trace trace-amber" d="M37 27l7 11 8-24h9" />
          <path className="needle" d="M34 4v24" />
          <circle cx="34" cy="28" r="2.4" />
        </svg>
      </span>
      <span className="wotlab-copy">
        <strong>WOT<span>LAB</span></strong>
        <small>{compact ? "PERFORMANCE DATA" : "AUTOMOTIVE ANALYSIS"}</small>
      </span>
    </div>
  );
}
