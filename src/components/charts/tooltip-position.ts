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
  const leftCandidate = cursorLeft - tooltipWidth - gap;
  const rightCandidate = cursorLeft + gap;
  const fitsLeft = leftCandidate >= edgePadding;
  const fitsRight = rightCandidate + tooltipWidth <= containerWidth - edgePadding;
  const preferRight = preference === "right";

  if (preferRight && fitsRight) return rightCandidate;
  if (!preferRight && fitsLeft) return leftCandidate;
  if (fitsRight) return rightCandidate;
  if (fitsLeft) return leftCandidate;

  const maximumLeft = Math.max(edgePadding, containerWidth - tooltipWidth - edgePadding);
  return Math.min(Math.max(edgePadding, preferRight ? rightCandidate : leftCandidate), maximumLeft);
}
