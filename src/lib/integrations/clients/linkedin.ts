/**
 * LinkedIn placeholder client.
 * OFF/MOCK/MANUAL/LIVE behavior. LIVE uses LinkedIn API v2 (userinfo, organizationLookup).
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";
import { trackedFetch } from "../usage";

export type LinkedInProfile = {
  id: string;
  name: string;
  headline?: string;
  connectionsCount?: number;
};

export type LinkedInCompany = {
  id: string;
  name: string;
  vanityName?: string;
  description?: string;
  industry?: string;
  staffCount?: number;
};

const MOCK_PROFILE: LinkedInProfile = {
  id: "mock-1",
  name: "Mock User",
  headline: "Operations & Sales",
  connectionsCount: 500,
};

function formatLinkedInName(first?: { localized?: { en_US?: string } }, last?: { localized?: { en_US?: string } }): string {
  const firstStr = first?.localized?.en_US ?? "";
  const lastStr = last?.localized?.en_US ?? "";
  return [firstStr, lastStr].filter(Boolean).join(" ").trim() || "Unknown";
}

export async function fetchLinkedInProfile(
  mode: IntegrationMode,
  config: Record<string, unknown>
): Promise<ProviderClientResult<LinkedInProfile | null>> {
  switch (mode) {
    case "off":
      return { ok: true, data: null, message: "OFF: no fetch" };
    case "mock":
      return { ok: true, data: MOCK_PROFILE, message: "Mock data" };
    case "manual":
      return { ok: true, data: null, message: "MANUAL: paste profile data from LinkedIn" };
    case "live": {
      const accessToken = typeof config.accessToken === "string" ? config.accessToken : null;
      if (!accessToken) {
        return { ok: false, data: null, message: "accessToken required in config for live LinkedIn profile" };
      }
      try {
        const res = await trackedFetch("linkedin", "userinfo", "https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          return {
            ok: false,
            data: null,
            message: `LinkedIn userinfo failed: HTTP ${res.status}`,
          };
        }
        const data = (await res.json()) as {
          sub?: string;
          id?: string;
          name?: string;
          given_name?: string;
          family_name?: string;
          firstName?: { localized?: { en_US?: string } };
          lastName?: { localized?: { en_US?: string } };
        };
        const id = data.sub ?? data.id ?? "unknown";
        const name =
          typeof data.name === "string"
            ? data.name
            : formatLinkedInName(data.firstName, data.lastName) !== "Unknown"
              ? formatLinkedInName(data.firstName, data.lastName)
              : [data.given_name, data.family_name].filter(Boolean).join(" ") || "Unknown";
        return {
          ok: true,
          data: { id, name },
        };
      } catch (err) {
        return {
          ok: false,
          data: null,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }
    default:
      return { ok: true, data: null, message: "Unknown mode" };
  }
}

export async function searchLinkedInCompanies(
  mode: IntegrationMode,
  config: Record<string, unknown>,
  query: string
): Promise<ProviderClientResult<LinkedInCompany[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF: no fetch" };
    case "mock":
      return { ok: true, data: [], message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: paste company data from LinkedIn" };
    case "live": {
      const accessToken = typeof config.accessToken === "string" ? config.accessToken : null;
      if (!accessToken) {
        return { ok: false, data: null, message: "accessToken required in config for LinkedIn company search" };
      }
      try {
        const url = `https://api.linkedin.com/v2/organizationLookup?q=vanityName&vanityName=${encodeURIComponent(query)}`;
        const res = await trackedFetch("linkedin", "organizationLookup", url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          const text = await res.text();
          if (res.status === 403 || res.status === 401) {
            return {
              ok: false,
              data: null,
              message:
                "LinkedIn company search requires LinkedIn Marketing Developer Platform access. Organization APIs are restricted to approved partners.",
            };
          }
          return {
            ok: false,
            data: null,
            message: `LinkedIn organizationLookup failed: HTTP ${res.status}${text ? ` - ${text}` : ""}`,
          };
        }
        const data = (await res.json()) as {
          elements?: Array<{
            id?: string;
            localizedName?: string;
            vanityName?: string;
            description?: { localized?: { en_US?: string } };
            staffCountRange?: { start?: number; end?: number };
          }>;
        };
        const companies: LinkedInCompany[] = (data.elements ?? []).map((el) => ({
          id: el.id ?? "unknown",
          name: el.localizedName ?? "",
          vanityName: el.vanityName,
          description: typeof el.description === "string" ? el.description : el.description?.localized?.en_US,
          staffCount: el.staffCountRange?.start ?? el.staffCountRange?.end,
        }));
        return { ok: true, data: companies };
      } catch (err) {
        return {
          ok: false,
          data: null,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
