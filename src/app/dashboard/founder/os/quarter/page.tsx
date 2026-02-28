"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchJsonThrow } from "@/lib/http/fetch-json";
import { AsyncState } from "@/components/ui/AsyncState";

type QuarterData = {
  id: string | null;
  startsAt: string;
  endsAt: string;
  title: string;
  notes: string | null;
  kpis?: Array<{
    id: string;
    key: string;
    label: string;
    targetValue: number;
    currentValue: number | null;
    unit: string;
  }>;
};

const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

export default function FounderOSQuarterPage() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [kpis, setKpis] = useState<Array<{ id?: string; key: string; label: string; targetValue: number; currentValue: number | null; unit: string }>>([]);

  const {
    data: quarter,
    loading,
    error,
    refetch,
  } = useRetryableFetch<QuarterData>("/api/internal/founder/os/quarter");

  useEffect(() => {
    if (quarter) {
      setTitle(quarter.title ?? "");
      setNotes(quarter.notes ?? "");
      setKpis(
        quarter.kpis?.length
          ? quarter.kpis
          : [{ key: "", label: "", targetValue: 0, currentValue: null, unit: "count" }]
      );
    }
  }, [quarter]);

  const { execute: executeSaveQuarter, pending: savingQuarter } = useAsyncAction(
    async () => {
      await fetchJsonThrow<QuarterData>("/api/internal/founder/os/quarter", {
        method: "PUT",
        body: JSON.stringify({ title, notes }),
      });
      refetch();
    },
    {
      toast: toastFn,
      successMessage: "Quarter saved.",
    }
  );

  const { execute: executeSaveKpis, pending: savingKpis } = useAsyncAction(
    async () => {
      const quarterId = quarter?.id ? `?quarterId=${encodeURIComponent(quarter.id)}` : "";
      const data = await fetchJsonThrow<{ kpis: typeof kpis }>(`/api/internal/founder/os/quarter/kpis${quarterId}`, {
        method: "PUT",
        body: JSON.stringify({
          kpis: kpis.filter((k) => k.key.trim() || k.label.trim()),
        }),
      });
      setKpis(data.kpis ?? []);
    },
    {
      toast: toastFn,
      successMessage: "KPIs saved.",
    }
  );

  const saving = savingQuarter || savingKpis;

  return (
    <div className="space-y-6" data-testid="founder-os-quarter">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quarter</h1>
        <p className="text-sm text-neutral-400 mt-1">Goals and KPI targets.</p>
      </div>

      <AsyncState loading={loading} error={error} onRetry={refetch}>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-amber-400/90 mb-3">Quarter details</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
              />
            </div>
            <p className="text-xs text-neutral-500">
              {quarter?.startsAt?.slice(0, 10)} – {quarter?.endsAt?.slice(0, 10)}
            </p>
            <button
              type="button"
              onClick={() => executeSaveQuarter()}
              disabled={saving}
              className="text-xs px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black disabled:opacity-50"
            >
              Save quarter
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium text-amber-400/90 mb-3">KPIs</h2>
          <div className="space-y-3">
            {kpis.map((k, i) => (
              <div key={k.id ?? i} className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <input
                  type="text"
                  value={k.key}
                  onChange={(e) => {
                    const next = [...kpis];
                    next[i] = { ...next[i], key: e.target.value };
                    setKpis(next);
                  }}
                  placeholder="Key"
                  className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
                />
                <input
                  type="text"
                  value={k.label}
                  onChange={(e) => {
                    const next = [...kpis];
                    next[i] = { ...next[i], label: e.target.value };
                    setKpis(next);
                  }}
                  placeholder="Label"
                  className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
                />
                <input
                  type="number"
                  value={k.targetValue || ""}
                  onChange={(e) => {
                    const next = [...kpis];
                    next[i] = { ...next[i], targetValue: parseFloat(e.target.value) || 0 };
                    setKpis(next);
                  }}
                  placeholder="Target"
                  className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
                />
                <input
                  type="number"
                  value={k.currentValue ?? ""}
                  onChange={(e) => {
                    const next = [...kpis];
                    const v = e.target.value;
                    next[i] = { ...next[i], currentValue: v === "" ? null : parseFloat(v) || 0 };
                    setKpis(next);
                  }}
                  placeholder="Current"
                  className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
                />
                <input
                  type="text"
                  value={k.unit}
                  onChange={(e) => {
                    const next = [...kpis];
                    next[i] = { ...next[i], unit: e.target.value };
                    setKpis(next);
                  }}
                  placeholder="Unit"
                  className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setKpis([...kpis, { key: "", label: "", targetValue: 0, currentValue: null, unit: "count" }])}
              className="text-xs text-amber-400"
            >
              + Add KPI
            </button>
            <div>
              <button
                type="button"
                onClick={() => executeSaveKpis()}
                disabled={saving}
                className="text-xs px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black disabled:opacity-50"
              >
                Save KPIs
              </button>
            </div>
          </div>
        </div>
      </AsyncState>

      <Link href="/dashboard/founder/os" className="text-sm text-amber-400 hover:underline">
        ← Founder OS
      </Link>
    </div>
  );
}
