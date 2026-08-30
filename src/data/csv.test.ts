import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv, parseRows } from "./csv";

describe("CSV ingestion", () => {
  it("detects semicolon and preserves quoted delimiters", () => {
    const text = 'Time (s);"Boost; actual (bar)"\n0;1,2\n1;1,4';
    expect(detectDelimiter(text)).toBe(";");
    expect(parseRows(text)[0][1]).toBe("Boost; actual (bar)");
    expect(parseCsv(text).columns["boost-actual-bar-1"][1]).toBe(1.4);
  });

  it("deduplicates names and detects irregular time", () => {
    const result = parseCsv("Time,Boost,Boost\n0,1,2\n0.1,2,3\n0.35,3,4");
    expect(result.channels.map((channel) => channel.name)).toEqual(["Time", "Boost", "Boost (2)"]);
    expect(result.metadata.irregularSampling).toBe(true);
  });
});
