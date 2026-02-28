"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Plus, Check, Circle } from "lucide-react";
import { toast } from "sonner";

export type BuildTaskItem = {
  id: string;
  title: string;
  type: string;
  priority: string;
  linkedLeadId: string | null;
  linkedLead: { id: string; title: string } | null;
  linkedCriticismItem: string | null;
  expectedOutcome: string | null;
  status: string;
  cursorPrompt: string | null;
  prSummary: string | null;
  humanApproved: boolean;
  businessImpact: string | null;
  createdAt: string;
  updatedAt: string;
};

const TYPES = ["bug", "feature", "refactor", "guardrail", "template"] as const;
const STATUSES = ["todo", "in_progress", "review", "done"] as const;
const IMPACTS = ["Acquire", "Deliver", "Improve"] as const;

export function BuildOpsPageClient({
  initialTasks,
}: {
  initialTasks: BuildTaskItem[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addType, setAddType] = useState<string>("feature");
  const [addPriority, setAddPriority] = useState<string>("medium");
  const [addExpectedOutcome, setAddExpectedOutcome] = useState("");
  const [addBusinessImpact, setAddBusinessImpact] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = useMemo(() => tasks.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterType && t.type !== filterType) return false;
    return true;
  }), [tasks, filterStatus, filterType]);

  async function createTask() {
    if (!addTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/build-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle.trim(),
          type: addType,
          priority: addPriority,
          expectedOutcome: addExpectedOutcome.trim() || null,
          businessImpact: addBusinessImpact || null,
        }),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks((prev) => [task, ...prev]);
        setAddTitle("");
        setAddExpectedOutcome("");
        setAddBusinessImpact("");
        setShowAdd(false);
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error ?? "Failed to create");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(
    id: string,
    updates: Partial<Pick<BuildTaskItem, "status" | "prSummary" | "humanApproved">>
  ) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/build-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      } else {
        toast.error("Failed to update task");
      }
    } catch {
      toast.error("Failed to update task");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-neutral-500">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
          <span className="text-xs text-neutral-500 ml-2">Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
          >
            <option value="">All</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setShowAdd((v) => !v)}
          >
            <Plus className="w-4 h-4 mr-1" /> Add task
          </Button>
        </div>

        {showAdd && (
          <div className="border border-neutral-700 rounded-lg p-4 mb-4 space-y-3">
            <h3 className="text-sm font-medium text-neutral-300">New build task</h3>
            <Input
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder="Title"
              className="bg-neutral-900 border-neutral-700"
            />
            <div className="flex gap-2 flex-wrap">
              <select
                value={addType}
                onChange={(e) => setAddType(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={addPriority}
                onChange={(e) => setAddPriority(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
              <select
                value={addBusinessImpact}
                onChange={(e) => setAddBusinessImpact(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200"
              >
                <option value="">Business impact (optional)</option>
                {IMPACTS.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <Textarea
              value={addExpectedOutcome}
              onChange={(e) => setAddExpectedOutcome(e.target.value)}
              placeholder="Expected outcome (optional)"
              rows={2}
              className="bg-neutral-900 border-neutral-700"
            />
            <div className="flex gap-2">
              <Button onClick={createTask} disabled={saving || !addTitle.trim()}>
                {saving ? "Adding…" : "Add task"}
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-neutral-500">No tasks. Add one to give Cloud Agent a clear list.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((t) => (
              <li
                key={t.id}
                className="border border-neutral-800 rounded-lg p-3 bg-neutral-900/30 flex flex-wrap items-start gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-neutral-200">{t.title}</span>
                    <Badge variant="outline" className="text-xs">{t.type}</Badge>
                    <Badge variant="outline" className="text-xs">{t.status.replace("_", " ")}</Badge>
                    {t.businessImpact && (
                      <span className="text-xs text-neutral-500">{t.businessImpact}</span>
                    )}
                    {t.humanApproved && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-emerald-400">
                        <Check className="w-3 h-3" /> Approved
                      </span>
                    )}
                  </div>
                  {t.linkedLead && (
                    <Link
                      href={`/dashboard/leads/${t.linkedLead.id}`}
                      className="text-xs text-neutral-500 hover:text-neutral-300"
                    >
                      → {t.linkedLead.title}
                    </Link>
                  )}
                  {t.expectedOutcome && (
                    <p className="text-xs text-neutral-500 mt-1">{t.expectedOutcome}</p>
                  )}
                  {t.prSummary && (
                    <p className="text-xs text-neutral-400 mt-1 border-t border-neutral-800 pt-2">{t.prSummary}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <select
                    value={t.status}
                    onChange={(e) => updateTask(t.id, { status: e.target.value })}
                    disabled={updatingId === t.id}
                    className="rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-200 disabled:opacity-50"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                  </select>
                  {t.status === "review" || t.status === "done" ? (
                    <button
                      type="button"
                      onClick={() => updateTask(t.id, { humanApproved: !t.humanApproved })}
                      disabled={updatingId === t.id}
                      className="inline-flex items-center gap-0.5 rounded border border-neutral-600 px-2 py-0.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
                      title={t.humanApproved ? "Revoke approval" : "Mark approved"}
                    >
                      {t.humanApproved ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                      {t.humanApproved ? "Approved" : "Approve"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
