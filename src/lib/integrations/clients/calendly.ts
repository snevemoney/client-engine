/**
 * Calendly placeholder client.
 * OFF/MOCK/MANUAL/LIVE behavior. LIVE is a stub for future API integration.
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";

export type CalendlyEvent = {
  id: string;
  uri: string;
  name: string;
  startTime: string;
  endTime: string;
  status: string;
};

const MOCK_EVENTS: CalendlyEvent[] = [
  { id: "mock-1", uri: "https://calendly.com/evt/1", name: "Discovery call", startTime: new Date().toISOString(), endTime: new Date().toISOString(), status: "active" },
  { id: "mock-2", uri: "https://calendly.com/evt/2", name: "Strategy session", startTime: new Date().toISOString(), endTime: new Date().toISOString(), status: "active" },
];

export async function fetchCalendlyEvents(
  mode: IntegrationMode,
  _config: Record<string, unknown>
): Promise<ProviderClientResult<CalendlyEvent[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF: no fetch" };
    case "mock":
      return { ok: true, data: MOCK_EVENTS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: paste events from Calendly dashboard" };
    case "live":
      return { ok: true, data: [], message: "LIVE: Calendly API not yet integrated" };
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
