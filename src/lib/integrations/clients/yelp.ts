/**
 * Yelp Fusion API client.
 * Finds local businesses with reviews and ratings.
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";
import { trackedFetch } from "../usage";

export type YelpBusiness = {
  id: string;
  name: string;
  url: string;
  rating: number;
  reviewCount: number;
  phone?: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  categories: string[];
  imageUrl?: string;
  isClosed: boolean;
};

const MOCK_RESULTS: YelpBusiness[] = [
  { id: "mock-1", name: "Mock: Thrive Coaching Studio", url: "https://yelp.com/mock1", rating: 4.7, reviewCount: 23, address: "100 Broadway", city: "New York", state: "NY", country: "US", categories: ["Life Coach", "Business Consulting"], isClosed: false },
  { id: "mock-2", name: "Mock: Balance & Beyond Wellness", url: "https://yelp.com/mock2", rating: 5.0, reviewCount: 15, phone: "+12125551234", address: "250 Park Ave", city: "New York", state: "NY", country: "US", categories: ["Life Coach", "Health Coach"], isClosed: false },
];

export async function searchYelpBusinesses(
  mode: IntegrationMode,
  config: Record<string, unknown>,
  query: string,
  location?: string,
): Promise<ProviderClientResult<YelpBusiness[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF" };
    case "mock":
      return { ok: true, data: MOCK_RESULTS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: not supported for Yelp" };
    case "live": {
      const apiKey = typeof config.accessToken === "string" ? config.accessToken : null;
      if (!apiKey) {
        return { ok: false, data: null, message: "Yelp Fusion API key required. Get one at yelp.com/developers/v3/manage_app" };
      }

      const params = new URLSearchParams({
        term: query,
        limit: "20",
        sort_by: "best_match",
      });
      if (location) {
        params.set("location", location);
      } else {
        params.set("location", "United States");
      }

      const url = `https://api.yelp.com/v3/businesses/search?${params}`;

      try {
        const res = await trackedFetch("yelp", "search", url, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!res.ok) {
          const text = await res.text();
          return { ok: false, data: null, message: `Yelp API error: HTTP ${res.status} — ${text.slice(0, 200)}` };
        }

        const json = await res.json() as {
          businesses?: Array<{
            id: string;
            name: string;
            url: string;
            rating: number;
            review_count: number;
            phone?: string;
            location: {
              address1?: string;
              city: string;
              state?: string;
              country: string;
            };
            categories?: Array<{ title: string }>;
            image_url?: string;
            is_closed: boolean;
          }>;
          error?: { description: string };
        };

        if (json.error) {
          return { ok: false, data: null, message: `Yelp: ${json.error.description}` };
        }

        const results: YelpBusiness[] = (json.businesses ?? []).map((b) => ({
          id: b.id,
          name: b.name,
          url: b.url,
          rating: b.rating,
          reviewCount: b.review_count,
          phone: b.phone || undefined,
          address: b.location.address1 ?? "",
          city: b.location.city,
          state: b.location.state,
          country: b.location.country,
          categories: (b.categories ?? []).map((c) => c.title),
          imageUrl: b.image_url || undefined,
          isClosed: b.is_closed,
        }));

        return { ok: true, data: results };
      } catch (err) {
        return { ok: false, data: null, message: err instanceof Error ? err.message : String(err) };
      }
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
