import type { TooltipPosition } from "@/domain/types";

interface TooltipPositionOptions {
  cursorLeft: number;
  tooltipWidth: number;
  containerWidth: number;
  preference: TooltipPosition;
  gap?: number;
  edgePadding?: number;
}

export function resolveTooltipLeft({ cursorLeft, tooltipWidth, containerWidth, preference, gap = 8, edgePadding = 8 }: TooltipPositionOptions): number {
  const safeTooltipWidth = Number.isFinite(tooltipWidth) ? Math.max(0, tooltipWidth) : 0;
  const safeEdgePadding = Number.isFinite(edgePadding) ? Math.max(0, edgePadding) : 8;
  const safeGap = Number.isFinite(gap) ? Math.max(0, gap) : 8;
  const safeContainerWidth = Number.isFinite(containerWidth) ? Math.max(0, containerWidth) : safeTooltipWidth + safeEdgePadding * 2;
  const safeCursorLeft = Number.isFinite(cursorLeft) ? cursorLeft : safeContainerWidth / 2;
  const leftCandidate = safeCursorLeft - safeTooltipWidth - safeGap;
  const rightCandidate = safeCursorLeft + safeGap;
  const fitsLeft = leftCandidate >= safeEdgePadding;
  const fitsRight = rightCandidate + safeTooltipWidth <= safeContainerWidth - safeEdgePadding;
  const preferRight = preference === "right";

  if (preferRight && fitsRight) return rightCandidate;
  if (!preferRight && fitsLeft) return leftCandidate;
  if (fitsRight) return rightCandidate;
  if (fitsLeft) return leftCandidate;

  const maximumLeft = Math.max(safeEdgePadding, safeContainerWidth - safeTooltipWidth - safeEdgePadding);
  return Math.min(Math.max(safeEdgePadding, preferRight ? rightCandidate : leftCandidate), maximumLeft);
}
