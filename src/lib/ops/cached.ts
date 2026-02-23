/**
 * Request-scoped cache for expensive ops functions.
 * React.cache() deduplicates calls within a single server request,
 * so parallel Suspense boundaries (CommandSection1 + CommandSection2)
 * share results instead of issuing redundant DB queries.
 */
import { cache } from "react";
import { getMoneyScorecard as _getMoneyScorecard } from "./moneyScorecard";
import { getFailuresAndInterventions as _getFailuresAndInterventions } from "./failuresInterventions";
import { getConstraintSnapshot as _getConstraintSnapshot } from "./constraint";
import { getOperatorSettings as _getOperatorSettings } from "./settings";
import { getOrCreateSystemLead as _getOrCreateSystemLead } from "./systemLead";

export const getCachedMoneyScorecard = cache(_getMoneyScorecard);
export const getCachedFailuresAndInterventions = cache(_getFailuresAndInterventions);
export const getCachedConstraintSnapshot = cache(_getConstraintSnapshot);
export const getCachedOperatorSettings = cache(_getOperatorSettings);
export const getCachedSystemLead = cache(_getOrCreateSystemLead);
