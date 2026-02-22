/**
 * Trust-to-Close checklist: stored in proposal artifact meta.
 * Keys: problemUnderstood, trustSignalsIncluded, riskReduced, unknownsStatedHonestly, nextStepClear.
 */

export const TRUST_TO_CLOSE_ITEMS = [
  { key: "problemUnderstood", label: "Problem understood" },
  { key: "trustSignalsIncluded", label: "Trust signals included" },
  { key: "riskReduced", label: "Risk reduced" },
  { key: "unknownsStatedHonestly", label: "Unknowns stated honestly" },
  { key: "nextStepClear", label: "Next step clear" },
] as const;

export type TrustToCloseChecklist = Partial<Record<(typeof TRUST_TO_CLOSE_ITEMS)[number]["key"], boolean>>;

export function getTrustToCloseFromMeta(meta: unknown): TrustToCloseChecklist {
  if (!meta || typeof meta !== "object") return {};
  const m = (meta as Record<string, unknown>).trustToCloseChecklist;
  if (!m || typeof m !== "object") return {};
  const o = m as Record<string, unknown>;
  const out: TrustToCloseChecklist = {};
  for (const { key } of TRUST_TO_CLOSE_ITEMS) {
    if (typeof o[key] === "boolean") out[key as keyof TrustToCloseChecklist] = o[key] as boolean;
  }
  return out;
}

export function allTrustToCloseComplete(checklist: TrustToCloseChecklist): boolean {
  return TRUST_TO_CLOSE_ITEMS.every(({ key }) => checklist[key] === true);
}
