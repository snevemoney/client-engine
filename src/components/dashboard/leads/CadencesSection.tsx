"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Pause, Play, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TRIGGER_LABELS: Record<string, string> = {
  scope_sent: "Scope follow-up",
  deployed: "Invoice reminder",
  invoiced: "Payment check",
  paid: "Record outcome",
};

type Cadence = {
  id: string;
  sourceType: string;
  sourceId: string;
  trigger: string;
  dueAt: string;
  completedAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
};

function isActive(c: Cadence): boolean {
  if (c.completedAt) return false;
  if (c.snoozedUntil && new Date(c.snoozedUntil) > new Date()) return false;
  return true;
}

function isSnoozed(c: Cadence): boolean {
  return !c.completedAt && !!c.snoozedUntil && new Date(c.snoozedUntil) > new Date();
}

export function CadencesSection({ leadId, onUpdate }: { leadId: string; onUpdate?: () => void }) {
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  function fetchCadences() {
    fetch(`/api/cadence?sourceType=lead&sourceId=${leadId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCadences(Array.isArray(data) ? data : []))
      .catch(() => setCadences([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchCadences();
  }, [leadId]);

  async function snooze(id: string) {
    setActing(id);
    try {
      const until = new Date();
      until.setDate(until.getDate() + 1);
      const res = await fetch(`/api/cadence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snoozedUntil: until.toISOString() }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Snoozed 1 day");
      fetchCadences();
      onUpdate?.();
    } catch {
      toast.error("Failed to snooze");
    } finally {
      setActing(null);
    }
  }

  async function resume(id: string) {
    setActing(id);
    try {
      const res = await fetch(`/api/cadence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snoozedUntil: null }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Resumed");
      fetchCadences();
      onUpdate?.();
    } catch {
      toast.error("Failed to resume");
    } finally {
      setActing(null);
    }
  }

  async function complete(id: string) {
    setActing(id);
    try {
      const res = await fetch(`/api/cadence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: true }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Marked done");
      fetchCadences();
      onUpdate?.();
    } catch {
      toast.error("Failed to complete");
    } finally {
      setActing(null);
    }
  }

  const active = cadences.filter(isActive);
  const snoozed = cadences.filter(isSnoozed);
  const completed = cadences.filter((c) => c.completedAt);

  if (loading) {
    return (
      <div className="border border-neutral-800 rounded-lg p-4">
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Bell className="w-3.5 h-3.5" />
          Cadences
        </h3>
        <div className="text-sm text-neutral-500">Loading…</div>
      </div>
    );
  }

  if (cadences.length === 0) return null;

  return (
    <div className="border border-neutral-800 rounded-lg p-4">
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Bell className="w-3.5 h-3.5" />
        Cadences
      </h3>
      <p className="text-xs text-neutral-500 mb-3">
        Follow-up reminders (scope sent, deployed, invoiced). Snooze pauses; complete marks done.
      </p>
      <div className="space-y-2">
        {active.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-2"
          >
            <div>
              <span className="text-sm font-medium text-neutral-200">
                {TRIGGER_LABELS[c.trigger] ?? c.trigger}
              </span>
              <span className="text-xs text-neutral-500 ml-2">
                due {new Date(c.dueAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-neutral-400 hover:text-neutral-200"
                onClick={() => snooze(c.id)}
                disabled={acting === c.id}
              >
                {acting === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                Pause
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-emerald-400 hover:text-emerald-300"
                onClick={() => complete(c.id)}
                disabled={acting === c.id}
              >
                {acting === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Done
              </Button>
            </div>
          </div>
        ))}
        {snoozed.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-800/50 px-3 py-2 opacity-75"
          >
            <div>
              <span className="text-sm font-medium text-neutral-400">
                {TRIGGER_LABELS[c.trigger] ?? c.trigger}
              </span>
              <span className="text-xs text-neutral-500 ml-2">
                paused until {new Date(c.snoozedUntil!).toLocaleDateString()}
              </span>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-emerald-400 hover:text-emerald-300"
                onClick={() => resume(c.id)}
                disabled={acting === c.id}
              >
                {acting === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Resume
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-neutral-400 hover:text-neutral-200"
                onClick={() => complete(c.id)}
                disabled={acting === c.id}
              >
                {acting === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Done
              </Button>
            </div>
          </div>
        ))}
        {completed.length > 0 && active.length === 0 && snoozed.length === 0 && (
          <p className="text-sm text-neutral-500">All cadences completed.</p>
        )}
      </div>
    </div>
  );
}
