"use client";

import { useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CadenceDueSummary } from "@/lib/ops/cadenceSummary";

export function CadenceDueCard({ data }: { data: CadenceDueSummary }) {
  const { dueToday } = data;
  const [processing, setProcessing] = useState(false);

  async function handleProcess() {
    setProcessing(true);
    try {
      const res = await fetch("/api/cadence/process", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(`Processed ${json.processed ?? 0} cadence(s)`);
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to process");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2">
        <Bell className="w-4 h-4 text-neutral-500" />
        Cadences Due
      </h2>
      <p className="text-xs text-neutral-500 mb-3">
        Follow-up reminders (scope sent, deployed, invoiced, record outcome) due today.
      </p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-200">
            {dueToday} due today
          </p>
        </div>
        <button
          type="button"
          onClick={handleProcess}
          disabled={processing || dueToday === 0}
          className="shrink-0 inline-flex items-center gap-2 rounded-md bg-neutral-100 text-neutral-900 px-3 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          Process
        </button>
      </div>
    </section>
  );
}
