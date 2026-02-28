"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Compass } from "lucide-react";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchJsonThrow } from "@/lib/http/fetch-json";
import { AsyncState } from "@/components/ui/AsyncState";

type Theme = { id: string; periodType: string; periodKey: string; theme: string; notes: string | null };

function getCurrentPeriods() {
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return {
    year: String(year),
    quarter: `${year}-Q${q}`,
    month: `${year}-${month}`,
  };
}

const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

export function PlanningThemesSection() {
  const [editing, setEditing] = useState<{ periodType: string; periodKey: string } | null>(null);
  const [editTheme, setEditTheme] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const periods = getCurrentPeriods();

  const {
    data: themesRaw,
    loading,
    error,
    refetch,
  } = useRetryableFetch<Theme[]>("/api/ops/planning-themes");

  const themes = Array.isArray(themesRaw) ? themesRaw : [];

  const getTheme = (periodType: string, periodKey: string) =>
    themes.find((t) => t.periodType === periodType && t.periodKey === periodKey);

  const { execute: executeSaveTheme, pending: saving } = useAsyncAction(
    async (periodType: string, periodKey: string) => {
      if (!editTheme.trim()) return;
      const data = await fetchJsonThrow<Theme>("/api/ops/planning-themes", {
        method: "POST",
        body: JSON.stringify({ periodType, periodKey, theme: editTheme.trim(), notes: editNotes.trim() || undefined }),
      });
      // We got the saved theme back, now refetch to ensure consistency
      void data;
      setEditing(null);
      refetch();
    },
    {
      toast: toastFn,
      successMessage: "Theme saved.",
    }
  );

  function startEdit(t: Theme) {
    setEditing({ periodType: t.periodType, periodKey: t.periodKey });
    setEditTheme(t.theme);
    setEditNotes(t.notes ?? "");
  }

  function startNew(periodType: string, periodKey: string) {
    setEditing({ periodType, periodKey });
    setEditTheme(getTheme(periodType, periodKey)?.theme ?? "");
    setEditNotes(getTheme(periodType, periodKey)?.notes ?? "");
  }

  const levels = [
    { periodType: "year", periodKey: periods.year, label: "Year theme" },
    { periodType: "quarter", periodKey: periods.quarter, label: "Quarter theme" },
    { periodType: "month", periodKey: periods.month, label: "Month theme" },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-neutral-300">Themes (year / quarter / month)</h2>
      <AsyncState loading={loading} error={error} onRetry={refetch}>
        <div className="rounded-lg border border-neutral-700 divide-y divide-neutral-700">
          {levels.map(({ periodType, periodKey, label }) => {
            const t = getTheme(periodType, periodKey);
            const isEditing = editing?.periodType === periodType && editing?.periodKey === periodKey;
            return (
              <div key={`${periodType}-${periodKey}`} className="p-4">
                <div className="text-xs text-neutral-500 mb-1">{label} — {periodKey}</div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editTheme}
                      onChange={(e) => setEditTheme(e.target.value)}
                      placeholder="Theme / focus"
                      className="bg-neutral-900"
                    />
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      rows={2}
                      className="bg-neutral-900 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => executeSaveTheme(periodType, periodKey)} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {t ? (
                        <>
                          <p className="text-sm text-neutral-200">{t.theme}</p>
                          {t.notes && <p className="text-xs text-neutral-500 mt-0.5">{t.notes}</p>}
                        </>
                      ) : (
                        <p className="text-sm text-neutral-500 italic">No theme set</p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => (t ? startEdit(t) : startNew(periodType, periodKey))}>
                      {t ? "Edit" : "Add"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AsyncState>
      <Link
        href="/dashboard/strategy"
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200"
      >
        <Compass className="w-4 h-4" />
        Open weekly strategy →
      </Link>
    </div>
  );
}
