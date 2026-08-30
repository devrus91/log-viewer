export function minMaxDownsample(x: Float64Array, y: Float64Array, threshold: number): [number[], number[]] {
  if (x.length <= threshold || threshold < 4) return [Array.from(x), Array.from(y)];
  const resultX: number[] = [x[0]];
  const resultY: number[] = [y[0]];
  const buckets = Math.max(1, Math.floor((threshold - 2) / 2));
  const bucketSize = (x.length - 2) / buckets;
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const start = Math.floor(1 + bucket * bucketSize);
    const end = Math.min(x.length - 1, Math.floor(1 + (bucket + 1) * bucketSize));
    let minIndex = start;
    let maxIndex = start;
    for (let index = start + 1; index < end; index += 1) {
      if (y[index] < y[minIndex]) minIndex = index;
      if (y[index] > y[maxIndex]) maxIndex = index;
    }
    for (const index of minIndex < maxIndex ? [minIndex, maxIndex] : [maxIndex, minIndex]) {
      resultX.push(x[index]);
      resultY.push(y[index]);
    }
  }
  resultX.push(x[x.length - 1]);
  resultY.push(y[y.length - 1]);
  return [resultX, resultY];
}
