/**
 * Apollo.io client — sales intelligence platform.
 * Finds people and companies by title, industry, keywords, location.
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";
import { trackedFetch } from "../usage";

export type ApolloPerson = {
  id: string;
  name: string;
  title?: string;
  email?: string;
  company?: string;
  companyDomain?: string;
  linkedinUrl?: string;
  city?: string;
  state?: string;
  country?: string;
};

export type ApolloCompany = {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  employeeCount?: number;
  city?: string;
  state?: string;
  country?: string;
  linkedinUrl?: string;
  website?: string;
};

const MOCK_PEOPLE: ApolloPerson[] = [
  { id: "mock-1", name: "Mock: Sarah Johnson", title: "Life Coach & Wellness Consultant", company: "Mindful Growth LLC", email: "sarah@example.com", city: "Austin", state: "TX", country: "US" },
  { id: "mock-2", name: "Mock: David Park", title: "Business Coach", company: "Peak Coaching Co", companyDomain: "peakcoaching.com", city: "San Francisco", state: "CA", country: "US" },
];

const MOCK_COMPANIES: ApolloCompany[] = [
  { id: "mock-c1", name: "Mock: Elevate Coaching Group", domain: "elevatecoaching.com", industry: "Professional Training & Coaching", employeeCount: 8, city: "Denver", country: "US" },
];

export async function searchApolloPeople(
  mode: IntegrationMode,
  config: Record<string, unknown>,
  query: string,
  location?: string,
): Promise<ProviderClientResult<ApolloPerson[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF" };
    case "mock":
      return { ok: true, data: MOCK_PEOPLE, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: not supported" };
    case "live": {
      const apiKey = typeof config.accessToken === "string" ? config.accessToken : null;
      if (!apiKey) {
        return { ok: false, data: null, message: "Apollo.io API key required. Get one at app.apollo.io/settings/integrations/api-keys" };
      }

      const body: Record<string, unknown> = {
        q_keywords: query,
        per_page: 25,
        page: 1,
      };
      if (location) {
        body.person_locations = [location];
      }

      try {
        const res = await trackedFetch("apollo", "search_people", "https://api.apollo.io/v1/mixed_people/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": apiKey,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          return { ok: false, data: null, message: `Apollo API error: HTTP ${res.status} — ${text.slice(0, 200)}` };
        }

        const json = await res.json() as {
          people?: Array<{
            id: string;
            first_name?: string;
            last_name?: string;
            title?: string;
            email?: string;
            organization_name?: string;
            organization?: { primary_domain?: string; linkedin_url?: string };
            linkedin_url?: string;
            city?: string;
            state?: string;
            country?: string;
          }>;
        };

        const results: ApolloPerson[] = (json.people ?? []).map((p) => ({
          id: p.id,
          name: [p.first_name, p.last_name].filter(Boolean).join(" "),
          title: p.title,
          email: p.email,
          company: p.organization_name,
          companyDomain: p.organization?.primary_domain,
          linkedinUrl: p.linkedin_url,
          city: p.city,
          state: p.state,
          country: p.country,
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

export async function searchApolloCompanies(
  mode: IntegrationMode,
  config: Record<string, unknown>,
  query: string,
  location?: string,
): Promise<ProviderClientResult<ApolloCompany[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF" };
    case "mock":
      return { ok: true, data: MOCK_COMPANIES, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: not supported" };
    case "live": {
      const apiKey = typeof config.accessToken === "string" ? config.accessToken : null;
      if (!apiKey) {
        return { ok: false, data: null, message: "Apollo.io API key required" };
      }

      const body: Record<string, unknown> = {
        q_organization_keyword_tags: [query],
        per_page: 25,
        page: 1,
      };
      if (location) {
        body.organization_locations = [location];
      }

      try {
        const res = await trackedFetch("apollo", "search_companies", "https://api.apollo.io/v1/mixed_companies/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": apiKey,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          return { ok: false, data: null, message: `Apollo API error: HTTP ${res.status} — ${text.slice(0, 200)}` };
        }

        const json = await res.json() as {
          organizations?: Array<{
            id: string;
            name: string;
            primary_domain?: string;
            industry?: string;
            estimated_num_employees?: number;
            city?: string;
            state?: string;
            country?: string;
            linkedin_url?: string;
            website_url?: string;
          }>;
        };

        const results: ApolloCompany[] = (json.organizations ?? []).map((o) => ({
          id: o.id,
          name: o.name,
          domain: o.primary_domain,
          industry: o.industry,
          employeeCount: o.estimated_num_employees,
          city: o.city,
          state: o.state,
          country: o.country,
          linkedinUrl: o.linkedin_url,
          website: o.website_url,
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
