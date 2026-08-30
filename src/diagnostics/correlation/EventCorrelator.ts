import type { DiagnosticEvent } from "@/domain/types";

export function correlateEvents(events: DiagnosticEvent[], windowMs: number): DiagnosticEvent[] {
  return events.map((event) => {
    const correlatedEventIds = events.filter((candidate) => candidate.id !== event.id && candidate.category !== event.category && Math.abs(candidate.peakTime - event.peakTime) * 1000 <= windowMs).map((candidate) => candidate.id);
    return { ...event, correlatedEventIds };
  });
}
