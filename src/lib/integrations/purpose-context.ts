/**
 * Purpose context for integration usage.
 *
 * When a page or API consumes integration data, it should declare its purpose.
 * This ensures we only fetch/display integrations relevant to that context.
 *
 * Pages that don't use integrations: no declaration needed.
 */

import { getProviderDef } from "./providerRegistry";
import type { IntegrationPurpose } from "./providerRegistry";

/** Purposes that a given page/context cares about. Empty = all (e.g. Settings, ops overview). */
export const PAGE_PURPOSES: Record<string, IntegrationPurpose[]> = {
  // Settings configures everything — no filter
  "/dashboard/settings": [],

  // Command center = ops overview, show all
  "/dashboard/command": [],

  // Purpose-specific pages
  "/dashboard/signals": ["monitoring"],
  "/dashboard/meta-ads": ["monitoring", "analytics"],
  "/dashboard/prospect": ["prospecting"],
  "/dashboard/ops-health": [],

  // API contexts (used when calling from server)
  "api:integrations-data:signals": ["monitoring"],
  "api:integrations-data:meta-ads": ["monitoring", "analytics"],
  "api:integrations-data:command": [],
  "api:research:connection-bridge": ["monitoring", "crm", "research"],
} as const;

/** Check if a provider serves any of the given purposes. Empty purposes = match all. */
export function providerMatchesPurpose(
  provider: string,
  purposes: IntegrationPurpose[],
): boolean {
  if (purposes.length === 0) return true;
  const def = getProviderDef(provider);
  if (!def) return false;
  return purposes.some((p) => def.purposes.includes(p));
}

/** Filter a list of provider keys to those matching the given purposes. */
export function filterProvidersByPurpose(
  providers: string[],
  purposes: IntegrationPurpose[],
): string[] {
  if (purposes.length === 0) return providers;
  return providers.filter((p) => providerMatchesPurpose(p, purposes));
}
