import type { ChartLineThickness, ChartTextSize, DiagnosticMarkerMode, DiagnosticSeverity, GridVisibility, TooltipContents, ValuePrecision } from "@/domain/types";

export const CHART_FONT_SIZES: Record<ChartTextSize, { axis: number; label: number }> = {
  compact: { axis: 10, label: 10 },
  standard: { axis: 12, label: 11 },
  large: { axis: 14, label: 13 },
};

export const CHART_LINE_WIDTHS: Record<ChartLineThickness, number> = {
  thin: 1.25,
  standard: 1.75,
  bold: 2.5,
};

export const SERIES_DASH_PATTERNS: number[][] = [[], [7, 4], [2, 3], [10, 3, 2, 3], [4, 3]];

export function gridStroke(visibility: GridVisibility, highContrast: boolean): string {
  const alpha = visibility === "subtle" ? .13 : visibility === "strong" ? .42 : .24;
  return `rgba(${highContrast ? "125,151,176" : "71,85,105"},${Math.min(.55, alpha + (highContrast ? .12 : 0))})`;
}

export function formatChartValue(value: number | undefined | null, precision: ValuePrecision, unavailable = "—"): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return unavailable;
  if (precision !== "auto") return value.toFixed(Number(precision));
  return Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(2);
}

export function diagnosticMarkerVisible(severity: DiagnosticSeverity, mode: DiagnosticMarkerMode): boolean {
  if (mode === "hidden") return false;
  if (mode === "critical") return severity === "critical";
  if (mode === "warning-critical") return severity === "warning" || severity === "critical";
  return true;
}

export function interpolateValue(leftValue: number | undefined, rightValue: number | undefined, ratio: number): number | null {
  if (leftValue === undefined || rightValue === undefined || !Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return null;
  return leftValue + (rightValue - leftValue) * Math.min(1, Math.max(0, ratio));
}

export function filterTooltipRows<T extends { active: boolean; pinned: boolean }>(rows: T[], contents: TooltipContents, focusEnabled: boolean): T[] {
  if (!focusEnabled || contents === "all") return rows;
  const filtered = contents === "focused" ? rows.filter((row) => row.active) : rows.filter((row) => row.active || row.pinned);
  return filtered.length ? filtered : rows;
}

export function tooltipRowsPerColumn(rowCount: number, columnCount: number): number {
  return Math.max(1, Math.ceil(rowCount / Math.max(1, columnCount)));
}
