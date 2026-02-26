/**
 * Hunter.io client — email finder and domain search.
 * Find professional email addresses for any domain.
 */

import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";
import { trackedFetch } from "../usage";

export type HunterEmail = {
  email: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  department?: string;
  confidence: number;
  linkedinUrl?: string;
};

export type HunterDomainResult = {
  domain: string;
  organization?: string;
  emails: HunterEmail[];
  totalEmails: number;
};

const MOCK_RESULTS: HunterDomainResult = {
  domain: "example-coaching.com",
  organization: "Mock Coaching Co",
  emails: [
    { email: "jane@example-coaching.com", firstName: "Jane", lastName: "Smith", position: "Founder", confidence: 95 },
    { email: "info@example-coaching.com", position: "General", confidence: 80 },
  ],
  totalEmails: 2,
};

export async function searchHunterDomain(
  mode: IntegrationMode,
  config: Record<string, unknown>,
  domain: string,
): Promise<ProviderClientResult<HunterDomainResult>> {
  switch (mode) {
    case "off":
      return { ok: true, data: { domain, emails: [], totalEmails: 0 }, message: "OFF" };
    case "mock":
      return { ok: true, data: MOCK_RESULTS, message: "Mock data" };
    case "manual":
      return { ok: true, data: { domain, emails: [], totalEmails: 0 }, message: "MANUAL: not supported" };
    case "live": {
      const apiKey = typeof config.accessToken === "string" ? config.accessToken : null;
      if (!apiKey) {
        return { ok: false, data: null, message: "Hunter.io API key required. Get one at hunter.io/api-keys" };
      }

      const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`;

      try {
        const res = await trackedFetch("hunter", "domain_search", url);
        if (!res.ok) {
          const text = await res.text();
          return { ok: false, data: null, message: `Hunter API error: HTTP ${res.status} — ${text.slice(0, 200)}` };
        }

        const json = await res.json() as {
          data?: {
            domain: string;
            organization?: string;
            emails?: Array<{
              value: string;
              first_name?: string;
              last_name?: string;
              position?: string;
              department?: string;
              confidence: number;
              linkedin?: string;
            }>;
          };
          errors?: Array<{ details: string }>;
        };

        if (json.errors?.length) {
          return { ok: false, data: null, message: `Hunter: ${json.errors[0].details}` };
        }

        const data = json.data;
        const emails: HunterEmail[] = (data?.emails ?? []).map((e) => ({
          email: e.value,
          firstName: e.first_name,
          lastName: e.last_name,
          position: e.position,
          department: e.department,
          confidence: e.confidence,
          linkedinUrl: e.linkedin,
        }));

        return {
          ok: true,
          data: {
            domain: data?.domain ?? domain,
            organization: data?.organization,
            emails,
            totalEmails: emails.length,
          },
        };
      } catch (err) {
        return { ok: false, data: null, message: err instanceof Error ? err.message : String(err) };
      }
    }
    default:
      return { ok: true, data: { domain, emails: [], totalEmails: 0 }, message: "Unknown mode" };
  }
}

/** Find a single email by name + domain */
export async function findHunterEmail(
  mode: IntegrationMode,
  config: Record<string, unknown>,
  domain: string,
  firstName: string,
  lastName: string,
): Promise<ProviderClientResult<HunterEmail | null>> {
  if (mode === "off") return { ok: true, data: null, message: "OFF" };
  if (mode === "mock") {
    return { ok: true, data: { email: `${firstName.toLowerCase()}@${domain}`, firstName, lastName, confidence: 90 }, message: "Mock" };
  }
  if (mode !== "live") return { ok: true, data: null, message: "Not in live mode" };

  const apiKey = typeof config.accessToken === "string" ? config.accessToken : null;
  if (!apiKey) return { ok: false, data: null, message: "Hunter.io API key required" };

  const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${apiKey}`;

  try {
    const res = await trackedFetch("hunter", "email_finder", url);
    if (!res.ok) return { ok: false, data: null, message: `Hunter error: HTTP ${res.status}` };
    const json = await res.json() as { data?: { email: string; first_name?: string; last_name?: string; position?: string; score?: number; linkedin?: string } };
    if (!json.data?.email) return { ok: true, data: null, message: "No email found" };
    return {
      ok: true,
      data: {
        email: json.data.email,
        firstName: json.data.first_name,
        lastName: json.data.last_name,
        position: json.data.position,
        confidence: json.data.score ?? 0,
        linkedinUrl: json.data.linkedin,
      },
    };
  } catch (err) {
    return { ok: false, data: null, message: err instanceof Error ? err.message : String(err) };
  }
}
