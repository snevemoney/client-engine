/**
 * A/R summary for Command Center: unpaid/invoiced project counts and totals.
 */

import { db } from "@/lib/db";

export type ARSummary = {
  unpaidCount: number;
  invoicedCount: number;
  unpaidTotal: number | null;
};

export async function getARSummary(): Promise<ARSummary> {
  const [unpaidAgg, invoicedCount] = await Promise.all([
    db.project.aggregate({
      where: {
        OR: [{ paymentStatus: "unpaid" }, { paymentStatus: null }],
      },
      _count: { id: true },
      _sum: { paymentAmount: true },
    }),
    db.project.count({
      where: {
        paymentStatus: { in: ["invoiced", "partial"] },
      },
    }),
  ]);

  const unpaidTotal = unpaidAgg._sum.paymentAmount
    ? Number(unpaidAgg._sum.paymentAmount)
    : null;

  return {
    unpaidCount: unpaidAgg._count.id,
    invoicedCount,
    unpaidTotal,
  };
}
