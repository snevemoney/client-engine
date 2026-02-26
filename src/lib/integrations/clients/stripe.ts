import type { IntegrationMode } from "../providerRegistry";
import type { ProviderClientResult } from "./types";
import { trackedFetch } from "../usage";

export type StripeCustomer = {
  id: string;
  email?: string;
  name?: string;
  description?: string;
  created: number;
  currency?: string;
};

const MOCK_CUSTOMERS: StripeCustomer[] = [
  { id: "mock-cus-1", email: "alice@example.com", name: "Alice Corp", created: Date.now() / 1000 },
  { id: "mock-cus-2", email: "bob@example.com", name: "Bob's Widgets", created: Date.now() / 1000 },
];

export async function fetchStripeCustomers(
  mode: IntegrationMode,
  config: Record<string, unknown>,
): Promise<ProviderClientResult<StripeCustomer[]>> {
  switch (mode) {
    case "off":
      return { ok: true, data: [], message: "OFF: no fetch" };
    case "mock":
      return { ok: true, data: MOCK_CUSTOMERS, message: "Mock data" };
    case "manual":
      return { ok: true, data: [], message: "MANUAL: export from Stripe dashboard" };
    case "live": {
      const secretKey = typeof config.accessToken === "string" ? config.accessToken : null;
      if (!secretKey) return { ok: false, data: null, message: "Stripe secret key required" };
      try {
        const url = "https://api.stripe.com/v1/customers?limit=100";
        const res = await trackedFetch("stripe", "fetch", url, {
          headers: { Authorization: `Bearer ${secretKey}` },
        });
        if (!res.ok) {
          const text = await res.text();
          return { ok: false, data: null, message: `Stripe: HTTP ${res.status} ${text.slice(0, 200)}` };
        }
        const body = (await res.json()) as {
          data?: Array<{
            id: string;
            email?: string;
            name?: string;
            description?: string;
            created: number;
            currency?: string;
          }>;
        };
        const data: StripeCustomer[] = (body.data ?? []).map((c) => ({
          id: c.id,
          email: c.email ?? undefined,
          name: c.name ?? undefined,
          description: c.description ?? undefined,
          created: c.created,
          currency: c.currency ?? undefined,
        }));
        return { ok: true, data };
      } catch (err) {
        return { ok: false, data: null, message: `Stripe: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
    default:
      return { ok: true, data: [], message: "Unknown mode" };
  }
}
