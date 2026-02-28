/**
 * Phase 7.1: Load learned weights for NBA ranking personalization.
 */
import { db } from "@/lib/db";
import { OperatorLearnedWeightKind } from "@prisma/client";

export type LearnedWeights = {
  ruleWeights: Map<string, number>;
  actionWeights: Map<string, number>;
};

export async function loadLearnedWeights(actorUserId: string): Promise<LearnedWeights> {
  const rows = await db.operatorLearnedWeight.findMany({
    where: { actorUserId },
    select: { kind: true, key: true, weight: true },
  });

  const ruleWeights = new Map<string, number>();
  const actionWeights = new Map<string, number>();

  for (const r of rows) {
    if (r.kind === OperatorLearnedWeightKind.rule) {
      ruleWeights.set(r.key, r.weight);
    } else {
      actionWeights.set(r.key, r.weight);
    }
  }

  return { ruleWeights, actionWeights };
}
