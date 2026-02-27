"use client";

import { useState, useEffect } from "react";

type ConversionData = {
  intakeToPromoted: number | null;
  promotedToSent: number | null;
  sentToAccepted: number | null;
  overallConversion: number | null;
  counts: {
    intake: number;
    promoted: number;
    proposalsSent: number;
    accepted: number;
  };
} | null;

type IntakeSummary = {
  newThisWeek: number;
  qualified: number;
  won: number;
} | null;

export function StrategyPipelineContext() {
  const [conversion, setConversion] = useState<ConversionData>(null);
  const [intake, setIntake] = useState<IntakeSummary>(null);

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/metrics/conversion?range=last_4_weeks", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/intake-leads/summary", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
    ]).then(([conv, intakeRes]) => {
      setConversion(conv.status === "fulfilled" ? conv.value : null);
      setIntake(intakeRes.status === "fulfilled" ? intakeRes.value : null);
    });
  }, []);

  const pct = (n: number | null | undefined) => n != null ? `${(n * 100).toFixed(0)}%` : "—";

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-4 space-y-3">
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Pipeline Context (Last 4 Weeks)</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <p className="text-xs text-neutral-500">Intake → Qualified</p>
          <p className="text-lg font-semibold">{pct(conversion?.intakeToPromoted)}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">Qualified → Sent</p>
          <p className="text-lg font-semibold">{pct(conversion?.promotedToSent)}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">Sent → Accepted</p>
          <p className="text-lg font-semibold">{pct(conversion?.sentToAccepted)}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">Overall Win Rate</p>
          <p className="text-lg font-semibold text-emerald-400">{pct(conversion?.overallConversion)}</p>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-neutral-500">
        <span>{conversion?.counts?.intake ?? "—"} total intake leads</span>
        <span>{intake?.won ?? "—"} deals won</span>
        <span>{intake?.qualified ?? "—"} currently qualified</span>
      </div>
    </div>
  );
}
