export function calculateWheelZoomRange(range: [number, number], totalSamples: number, anchorRatio: number, deltaY: number): [number, number] {
  if (totalSamples <= 1 || deltaY === 0) return range;
  const maximumIndex = totalSamples - 1;
  const start = Math.max(0, Math.min(maximumIndex, Math.min(range[0], range[1])));
  const end = Math.max(start, Math.min(maximumIndex, Math.max(range[0], range[1])));
  const currentLength = end - start + 1;
  const minimumLength = Math.min(4, currentLength, totalSamples);
  const factor = deltaY > 0 ? 1.18 : .84;
  const nextLength = Math.max(minimumLength, Math.min(totalSamples, Math.round(currentLength * factor)));
  if (nextLength === currentLength) return [start, end];

  const ratio = Math.max(0, Math.min(1, anchorRatio));
  const anchorIndex = start + ratio * (currentLength - 1);
  const unclampedStart = Math.round(anchorIndex - ratio * (nextLength - 1));
  const nextStart = Math.max(0, Math.min(totalSamples - nextLength, unclampedStart));
  return [nextStart, nextStart + nextLength - 1];
}
