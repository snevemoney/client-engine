/**
 * Request-scoped cache for expensive ops functions.
 * React.cache() deduplicates calls within a single server request,
 * so parallel Suspense boundaries (CommandSection1 + CommandSection2)
 * share results instead of issuing redundant DB queries.
 * unstable_cache adds cross-request caching (30–60s) for heaviest fetchers.
 */
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getMoneyScorecard as _getMoneyScorecard } from "./moneyScorecard";
import { getFailuresAndInterventions as _getFailuresAndInterventions } from "./failuresInterventions";
import { getConstraintSnapshot as _getConstraintSnapshot } from "./constraint";
import { getOperatorSettings as _getOperatorSettings } from "./settings";
import { getOrCreateSystemLead as _getOrCreateSystemLead } from "./systemLead";
import { getOpsHealth as _getOpsHealth } from "./opsHealth";
import { getSalesLeakReport as _getSalesLeakReport } from "./salesLeak";
import { getCurrentStrategyWeek as _getCurrentStrategyWeek } from "./strategyWeek";

const CACHE_TTL = 45;

export const getCachedMoneyScorecard = cache(
  unstable_cache(_getMoneyScorecard, ["money-scorecard"], { revalidate: CACHE_TTL })
);
export const getCachedFailuresAndInterventions = cache(
  unstable_cache(_getFailuresAndInterventions, ["failures-interventions"], { revalidate: CACHE_TTL })
);
export const getCachedConstraintSnapshot = cache(_getConstraintSnapshot);
export const getCachedOperatorSettings = cache(_getOperatorSettings);
export const getCachedSystemLead = cache(_getOrCreateSystemLead);

export const getCachedOpsHealth = cache(
  unstable_cache(_getOpsHealth, ["ops-health"], { revalidate: CACHE_TTL })
);
export const getCachedSalesLeakReport = cache(
  unstable_cache(_getSalesLeakReport, ["sales-leak-report"], { revalidate: CACHE_TTL })
);
export const getCachedCurrentStrategyWeek = cache(
  unstable_cache(_getCurrentStrategyWeek, ["strategy-week-current"], { revalidate: CACHE_TTL })
);
