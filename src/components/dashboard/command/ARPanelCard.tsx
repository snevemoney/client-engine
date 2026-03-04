"use client";

import Link from "next/link";
import { DollarSign } from "lucide-react";
import type { ARSummary } from "@/lib/ops/arSummary";

export function ARPanelCard({ data }: { data: ARSummary }) {
  const { unpaidCount, invoicedCount, unpaidTotal } = data;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-neutral-500" />
        A/R Panel
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        Unpaid and invoiced projects. Follow up on payment for deployed work.
      </p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-200">
            {unpaidCount} unpaid · {invoicedCount} invoiced
            {unpaidTotal != null && unpaidTotal > 0 && (
              <span className="text-neutral-400 ml-1">· ${unpaidTotal.toLocaleString()}</span>
            )}
          </p>
        </div>
        <Link
          href="/dashboard/deploys?filter=unpaid"
          className="shrink-0 inline-flex items-center gap-2 rounded-md bg-neutral-100 text-neutral-900 px-3 py-2 text-sm font-medium hover:bg-neutral-200"
        >
          <DollarSign className="w-4 h-4" />
          View Deploys
        </Link>
      </div>
    </section>
  );
}
