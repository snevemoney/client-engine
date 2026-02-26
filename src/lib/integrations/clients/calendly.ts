/**
 * Calendly placeholder client.
 * OFF/MOCK/MANUAL/LIVE behavior. LIVE is a stub for future API integration.
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";
import { trackedFetch } from "../usage";

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
    case "live": {
      const accessToken = _config.accessToken;
      if (typeof accessToken !== "string" || !accessToken) {
        return { ok: false, data: null, message: "Calendly: accessToken required" };
      }
      try {
        const meRes = await trackedFetch(
          "calendly",
          "fetch",
          "https://api.calendly.com/users/me",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!meRes.ok) {
          const errText = await meRes.text();
          return { ok: false, data: null, message: `Calendly users/me: ${meRes.status} ${errText}` };
        }
        const meData = (await meRes.json()) as { resource?: { uri?: string } };
        const userUri = meData.resource?.uri;
        if (!userUri) {
          return { ok: false, data: null, message: "Calendly: no user URI in response" };
        }
        const params = new URLSearchParams({
          user: userUri,
          status: "active",
          count: "50",
          sort: "start_time:desc",
        });
        const eventsRes = await trackedFetch(
          "calendly",
          "fetch",
          `https://api.calendly.com/scheduled_events?${params}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!eventsRes.ok) {
          const errText = await eventsRes.text();
          return { ok: false, data: null, message: `Calendly scheduled_events: ${eventsRes.status} ${errText}` };
        }
        const eventsData = (await eventsRes.json()) as {
          collection?: Array<{
            uri?: string;
            name?: string;
            start_time?: string;
            end_time?: string;
            status?: string;
            event_type?: { name?: string; display_name?: string };
          }>;
        };
        const rawEvents = eventsData.collection ?? [];
        const events: CalendlyEvent[] = rawEvents.map((e) => {
          const uri = e.uri ?? "";
          const id = uri.split("/").pop() ?? uri;
          const eventName =
            e.name ??
            e.event_type?.name ??
            e.event_type?.display_name ??
            "Scheduled event";
          return {
            id,
            uri,
            name: eventName,
            startTime: e.start_time ?? "",
            endTime: e.end_time ?? e.start_time ?? "",
            status: e.status ?? "active",
          };
        });
        return { ok: true, data: events, message: `LIVE: ${events.length} events` };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, data: null, message: `Calendly: ${msg}` };
      }
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
