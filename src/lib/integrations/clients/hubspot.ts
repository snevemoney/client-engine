import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";
import { trackedFetch } from "../usage";

export type HubSpotContact = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  website?: string;
  createdAt?: string;
};

export type HubSpotCompany = {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  city?: string;
  description?: string;
};

const MOCK_CONTACTS: HubSpotContact[] = [
  { id: "mock-1", email: "jane@example.com", firstName: "Jane", lastName: "Doe", company: "Acme Inc" },
  { id: "mock-2", email: "john@example.com", firstName: "John", lastName: "Smith", company: "Widgets Co" },
];

export async function fetchHubSpotContacts(
  mode: IntegrationMode,
  config: Record<string, unknown>,
): Promise<ProviderClientResult<HubSpotContact[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF: no fetch" };
    case "mock":
      return { ok: true, data: MOCK_CONTACTS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: paste contacts from HubSpot" };
    case "live": {
      const accessToken = typeof config.accessToken === "string" ? config.accessToken : null;
      if (!accessToken) return { ok: false, data: null, message: "HubSpot access token required" };
      try {
        const url = "https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=email,firstname,lastname,company,website";
        const res = await trackedFetch("hubspot", "fetch", url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          const text = await res.text();
          return { ok: false, data: null, message: `HubSpot contacts: HTTP ${res.status} ${text.slice(0, 200)}` };
        }
        const body = (await res.json()) as {
          results?: Array<{
            id: string;
            properties?: {
              email?: string;
              firstname?: string;
              lastname?: string;
              company?: string;
              website?: string;
              createdate?: string;
            };
          }>;
        };
        const data: HubSpotContact[] = (body.results ?? []).map((c) => ({
          id: c.id,
          email: c.properties?.email,
          firstName: c.properties?.firstname,
          lastName: c.properties?.lastname,
          company: c.properties?.company,
          website: c.properties?.website,
          createdAt: c.properties?.createdate,
        }));
        return { ok: true, data };
      } catch (err) {
        return { ok: false, data: null, message: `HubSpot: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}

export async function searchHubSpotCompanies(
  mode: IntegrationMode,
  config: Record<string, unknown>,
  query: string,
): Promise<ProviderClientResult<HubSpotCompany[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF: no search" };
    case "mock":
      return { ok: true, data: [], message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: paste company data from HubSpot" };
    case "live": {
      const accessToken = typeof config.accessToken === "string" ? config.accessToken : null;
      if (!accessToken) return { ok: false, data: null, message: "HubSpot access token required" };
      try {
        const url = "https://api.hubapi.com/crm/v3/objects/companies/search";
        const res = await trackedFetch("hubspot", "search", url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: "name",
                operator: "CONTAINS_TOKEN",
                value: query,
              }],
            }],
            properties: ["name", "domain", "industry", "city", "description"],
            limit: 50,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          return { ok: false, data: null, message: `HubSpot search: HTTP ${res.status} ${text.slice(0, 200)}` };
        }
        const body = (await res.json()) as {
          results?: Array<{
            id: string;
            properties?: {
              name?: string;
              domain?: string;
              industry?: string;
              city?: string;
              description?: string;
            };
          }>;
        };
        const data: HubSpotCompany[] = (body.results ?? []).map((c) => ({
          id: c.id,
          name: c.properties?.name ?? "",
          domain: c.properties?.domain,
          industry: c.properties?.industry,
          city: c.properties?.city,
          description: c.properties?.description,
        }));
        return { ok: true, data };
      } catch (err) {
        return { ok: false, data: null, message: `HubSpot: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
