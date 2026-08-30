import type { ChannelMetadata, DatasetTransfer, LogMetadata } from "@/domain/types";

const PALETTE = ["#66d9ef", "#a78bfa", "#fbbf24", "#34d399", "#fb7185", "#60a5fa", "#f472b6", "#f97316", "#2dd4bf", "#c084fc"];

export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((line) => line.trim() && !line.trimStart().startsWith("#")) ?? "";
  const candidates = [",", ";", "\t"];
  let winner = ",";
  let max = -1;
  for (const candidate of candidates) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < first.length; index += 1) {
      if (first[index] === '"') quoted = !quoted;
      else if (!quoted && first[index] === candidate) count += 1;
    }
    if (count > max) {
      max = count;
      winner = candidate;
    }
  }
  return winner;
}

export function parseRows(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some((value) => value.length > 0) && !row[0]?.trimStart().startsWith("#")) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field.trim());
  if (row.some((value) => value.length > 0) && !row[0]?.trimStart().startsWith("#")) rows.push(row);
  return rows;
}

export function extractUnit(name: string): string {
  const match = name.match(/\(([^)]+)\)\s*$/);
  if (match) return match[1];
  const normalized = name.toLowerCase();
  if (/rpm|engine speed/.test(normalized)) return "rpm";
  if (/throttle|pedal|duty|trim|slip/.test(normalized)) return "%";
  if (/temperature|temp/.test(normalized)) return "°C";
  if (/boost|pressure/.test(normalized)) return "bar";
  if (/torque/.test(normalized)) return "Nm";
  if (/speed/.test(normalized)) return "km/h";
  if (/time|timestamp/.test(normalized)) return "s";
  return "—";
}

export function inferGroup(name: string): string {
  const value = name.toLowerCase();
  if (/rpm|engine speed|coolant|engine temp/.test(value)) return "Engine";
  if (/boost|map|pressure pre throttle/.test(value)) return "Boost";
  if (/fuel|lambda|afr|inject/.test(value)) return "Fuel";
  if (/ignition|knock|timing/.test(value)) return "Ignition";
  if (/torque/.test(value)) return "Torque";
  if (/gear|transmission|clutch/.test(value)) return "Transmission";
  if (/wheel|vehicle speed|velocity/.test(value)) return "Wheel Speed";
  if (/temp|iat|temperature/.test(value)) return "Temperature";
  if (/air|maf|flow/.test(value)) return "Airflow";
  return "Other";
}

export function safeId(name: string, index: number): string {
  const base = name.toLowerCase().replace(/[^a-z0-9а-яё]+/giu, "-").replace(/^-|-$/g, "") || "channel";
  return `${base}-${index}`;
}

function stats(values: Float64Array): Pick<ChannelMetadata, "min" | "max" | "average" | "sampleCount"> {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
    sum += value;
    count += 1;
  }
  return { min: count ? min : Number.NaN, max: count ? max : Number.NaN, average: count ? sum / count : Number.NaN, sampleCount: count };
}

function makeUniqueHeaders(headers: string[]): string[] {
  const counts = new Map<string, number>();
  return headers.map((header, index) => {
    const clean = header || `Column ${index + 1}`;
    const count = counts.get(clean) ?? 0;
    counts.set(clean, count + 1);
    return count === 0 ? clean : `${clean} (${count + 1})`;
  });
}

export function parseCsv(text: string, filename = "log.csv", fileSize = text.length): DatasetTransfer {
  const rows = parseRows(text);
  if (rows.length < 2) throw new Error("CSV does not contain data rows");
  const headers = makeUniqueHeaders(rows[0]);
  const dataRows = rows.slice(1);
  const columns: Record<string, Float64Array> = {};
  const channels: ChannelMetadata[] = [];

  headers.forEach((name, columnIndex) => {
    const id = safeId(name, columnIndex);
    const values = new Float64Array(dataRows.length);
    values.fill(Number.NaN);
    dataRows.forEach((row, rowIndex) => {
      const raw = row[columnIndex]?.trim();
      if (!raw || /^(nan|null|n\/a)$/i.test(raw)) return;
      const normalized = raw.includes(",") && !raw.includes(".") ? raw.replace(",", ".") : raw;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) values[rowIndex] = parsed;
    });
    columns[id] = values;
    channels.push({
      id,
      name,
      originalName: rows[0][columnIndex] || name,
      unit: extractUnit(name),
      group: inferGroup(name),
      type: "number",
      color: PALETTE[columnIndex % PALETTE.length],
      ...stats(values),
    });
  });

  const timeIndex = channels.findIndex((channel) => /^(time|time \(s\)|timestamp|log time)/i.test(channel.name));
  const timeChannel = channels[Math.max(0, timeIndex)];
  const time = columns[timeChannel.id];
  let minInterval = Infinity;
  let maxInterval = 0;
  let intervalSum = 0;
  let intervalCount = 0;
  for (let index = 1; index < time.length; index += 1) {
    const interval = time[index] - time[index - 1];
    if (Number.isFinite(interval) && interval > 0) {
      minInterval = Math.min(minInterval, interval);
      maxInterval = Math.max(maxInterval, interval);
      intervalSum += interval;
      intervalCount += 1;
    }
  }
  const duration = time.length > 1 && Number.isFinite(time[time.length - 1] - time[0]) ? time[time.length - 1] - time[0] : 0;
  const averageInterval = intervalCount ? intervalSum / intervalCount : 0;
  const metadata: LogMetadata = {
    id: `${filename}-${fileSize}-${dataRows.length}`,
    filename,
    fileSize,
    rows: dataRows.length,
    channels: channels.length,
    timeChannelId: timeChannel.id,
    duration,
    averageSampleRate: averageInterval ? 1 / averageInterval : 0,
    minSampleInterval: minInterval === Infinity ? 0 : minInterval,
    maxSampleInterval: maxInterval,
    irregularSampling: averageInterval > 0 && maxInterval - minInterval > averageInterval * 0.1,
  };
  return { metadata, channels, columns };
}
