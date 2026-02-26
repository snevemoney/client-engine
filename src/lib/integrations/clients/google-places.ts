/**
 * Google Places API client.
 * Finds local businesses by type + location.
 * Uses the Places Text Search (New) endpoint.
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";
import { trackedFetch } from "../usage";

export type PlaceBusiness = {
  id: string;
  name: string;
  address: string;
  rating?: number;
  totalRatings?: number;
  website?: string;
  phone?: string;
  types: string[];
  mapsUrl?: string;
};

const MOCK_RESULTS: PlaceBusiness[] = [
  { id: "mock-1", name: "Mock: Jane's Life Coaching", address: "123 Main St, New York, NY", rating: 4.8, totalRatings: 52, website: "https://example.com", types: ["health_and_wellness"], mapsUrl: "https://maps.google.com" },
  { id: "mock-2", name: "Mock: Peak Performance Coaching", address: "456 Oak Ave, Los Angeles, CA", rating: 4.5, totalRatings: 31, types: ["professional_services"], mapsUrl: "https://maps.google.com" },
  { id: "mock-3", name: "Mock: Mindful Growth Studio", address: "789 Pine Rd, Chicago, IL", rating: 4.9, totalRatings: 87, website: "https://example.com", phone: "+13125551234", types: ["health_and_wellness"], mapsUrl: "https://maps.google.com" },
];

export async function searchGooglePlaces(
  mode: IntegrationMode,
  config: Record<string, unknown>,
  query: string,
  location?: string,
): Promise<ProviderClientResult<PlaceBusiness[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF" };
    case "mock":
      return { ok: true, data: MOCK_RESULTS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: not supported for Google Places" };
    case "live": {
      const apiKey = typeof config.accessToken === "string" ? config.accessToken : null;
      if (!apiKey) {
        return { ok: false, data: null, message: "Google Cloud API key required. Enable Places API in your Google Cloud Console." };
      }

      const textQuery = location ? `${query} in ${location}` : query;
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(textQuery)}&key=${apiKey}`;

      try {
        const res = await trackedFetch("google_places", "search", url);
        if (!res.ok) {
          return { ok: false, data: null, message: `Google Places API error: HTTP ${res.status}` };
        }
        const json = await res.json() as {
          status: string;
          error_message?: string;
          results?: Array<{
            place_id: string;
            name: string;
            formatted_address: string;
            rating?: number;
            user_ratings_total?: number;
            types?: string[];
            geometry?: { location: { lat: number; lng: number } };
          }>;
        };

        if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
          return { ok: false, data: null, message: `Places API: ${json.status} — ${json.error_message ?? "unknown error"}` };
        }

        const results: PlaceBusiness[] = (json.results ?? []).map((p) => ({
          id: p.place_id,
          name: p.name,
          address: p.formatted_address,
          rating: p.rating,
          totalRatings: p.user_ratings_total,
          types: p.types ?? [],
          mapsUrl: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
        }));

        // Fetch website/phone details for top results (up to 5 to stay within quota)
        const detailed = await Promise.all(
          results.slice(0, 5).map(async (place) => {
            try {
              const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.id}&fields=website,formatted_phone_number&key=${apiKey}`;
              const dRes = await trackedFetch("google_places", "detail", detailUrl);
              if (dRes.ok) {
                const dJson = await dRes.json() as { result?: { website?: string; formatted_phone_number?: string } };
                return { ...place, website: dJson.result?.website, phone: dJson.result?.formatted_phone_number };
              }
            } catch { /* skip detail errors */ }
            return place;
          })
        );

        return { ok: true, data: [...detailed, ...results.slice(5)] };
      } catch (err) {
        return { ok: false, data: null, message: err instanceof Error ? err.message : String(err) };
      }
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
