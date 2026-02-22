"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SALES_SCRIPTS } from "@/lib/sales-scripts";

const TOUCH_TYPES = ["EMAIL", "CALL", "LINKEDIN_DM", "MEETING", "FOLLOW_UP", "REFERRAL_ASK", "CHECK_IN"] as const;
const SOURCE_CHANNELS = [
  "LINKEDIN",
  "YOUTUBE",
  "TIKTOK",
  "INSTAGRAM",
  "X",
  "THREADS",
  "NETWORKING_EVENT",
  "REFERRAL_INTRO",
  "REFERRAL",
  "NEWSLETTER",
  "EMAIL_OUTREACH",
  "OTHER",
] as const;
const REFERRAL_ASK_STATUSES = ["none", "primed", "asked", "received"] as const;
const RELATIONSHIP_STATUSES = ["active", "dormant", "nurture"] as const;

export interface LeadTouch {
  id: string;
  type: string;
  direction: string;
  summary: string;
  scriptUsed: string | null;
  outcome: string | null;
  nextTouchAt: string | null;
  createdAt: string;
}

export interface LeadReferral {
  id: string;
  referredName: string;
  referredCompany: string | null;
  status: string;
  createdAt: string;
}

interface SalesProcessPanelProps {
  leadId: string;
  leadSourceType: string | null;
  leadSourceChannel: string | null;
  sourceDetail: string | null;
  introducedBy: string | null;
  referralAskStatus: string | null;
  referralCount: number;
  relationshipStatus: string | null;
  relationshipLastCheck: string | null;
  touchCount: number;
  nextContactAt: string | null;
  lastContactAt: string | null;
  touches: LeadTouch[];
  referralsReceived: LeadReferral[];
  onUpdate: () => void;
  updateField: (field: string, value: string | null) => void;
  updateDateField: (field: "nextContactAt" | "lastContactAt" | "relationshipLastCheck", value: string | null) => void;
}

export function SalesProcessPanel({
  leadId,
  leadSourceType,
  leadSourceChannel,
  sourceDetail,
  introducedBy,
  referralAskStatus,
  referralCount,
  relationshipStatus,
  relationshipLastCheck,
  touchCount,
  nextContactAt,
  lastContactAt,
  touches,
  referralsReceived,
  onUpdate,
  updateField,
  updateDateField,
}: SalesProcessPanelProps) {
  const [showTouchForm, setShowTouchForm] = useState(false);
  const [showReferralForm, setShowReferralForm] = useState(false);
  const [touchType, setTouchType] = useState<string>("EMAIL");
  const [touchDirection, setTouchDirection] = useState<"outbound" | "inbound">("outbound");
  const [touchSummary, setTouchSummary] = useState("");
  const [touchOutcome, setTouchOutcome] = useState("");
  const [touchNextTouchAt, setTouchNextTouchAt] = useState("");
  const [touchScriptUsed, setTouchScriptUsed] = useState("");
  const [savingTouch, setSavingTouch] = useState(false);
  const [refName, setRefName] = useState("");
  const [refCompany, setRefCompany] = useState("");
  const [savingRef, setSavingRef] = useState(false);

  async function submitTouch() {
    if (!touchSummary.trim()) return;
    setSavingTouch(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/touches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: touchType,
          direction: touchDirection,
          summary: touchSummary.trim(),
          outcome: touchOutcome.trim() || undefined,
          nextTouchAt: touchNextTouchAt ? `${touchNextTouchAt}T12:00:00.000Z` : null,
          scriptUsed: touchScriptUsed.trim() || undefined,
        }),
      });
      if (res.ok) {
        setTouchSummary("");
        setTouchOutcome("");
        setTouchNextTouchAt("");
        setTouchScriptUsed("");
        setShowTouchForm(false);
        onUpdate();
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to log touch");
      }
    } catch (e) {
      alert("Request failed");
    }
    setSavingTouch(false);
  }

  async function submitReferral() {
    if (!refName.trim()) return;
    setSavingRef(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/referrals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referredName: refName.trim(),
          referredCompany: refCompany.trim() || undefined,
        }),
      });
      if (res.ok) {
        setRefName("");
        setRefCompany("");
        setShowReferralForm(false);
        onUpdate();
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to log referral");
      }
    } catch (e) {
      alert("Request failed");
    }
    setSavingRef(false);
  }

  return (
    <div className="border border-neutral-800 rounded-lg p-4 space-y-4">
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Sales process</h3>

      {/* Source & acquisition */}
      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Source channel</label>
          <select
            value={leadSourceChannel ?? ""}
            onChange={(e) => updateField("leadSourceChannel", e.target.value || null)}
            className="rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 px-2 py-1.5 w-full text-sm"
          >
            <option value="">—</option>
            {SOURCE_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c === "X" ? "X (Twitter)" : c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Source detail</label>
          <Input
            placeholder="e.g. Montreal meetup, LinkedIn post: AI audit"
            value={sourceDetail ?? ""}
            onChange={(e) => updateField("sourceDetail", e.target.value || null)}
            className="h-8 text-sm bg-neutral-900 border-neutral-700"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-neutral-500 block mb-1">Introduced by</label>
          <Input
            placeholder="Referral source / connector"
            value={introducedBy ?? ""}
            onChange={(e) => updateField("introducedBy", e.target.value || null)}
            className="h-8 text-sm bg-neutral-900 border-neutral-700"
          />
        </div>
      </div>

      {/* Touch logger */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-neutral-500">Touch count: {touchCount}</span>
          {nextContactAt && (
            <span className="text-xs text-neutral-500">Next: {new Date(nextContactAt).toLocaleDateString()}</span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowTouchForm((v) => !v)}
          >
            {showTouchForm ? "Cancel" : "Log touch"}
          </Button>
        </div>
        {showTouchForm && (
          <div className="border border-neutral-700 rounded-md p-3 space-y-2 bg-neutral-900/50">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={touchType}
                onChange={(e) => setTouchType(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-900 text-sm px-2 py-1.5"
              >
                {TOUCH_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
              <select
                value={touchDirection}
                onChange={(e) => setTouchDirection(e.target.value as "outbound" | "inbound")}
                className="rounded-md border border-neutral-700 bg-neutral-900 text-sm px-2 py-1.5"
              >
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </div>
            <Textarea
              placeholder="Summary (required)"
              value={touchSummary}
              onChange={(e) => setTouchSummary(e.target.value)}
              rows={2}
              className="text-sm bg-neutral-900 border-neutral-700"
            />
            <Input
              placeholder="Outcome (optional)"
              value={touchOutcome}
              onChange={(e) => setTouchOutcome(e.target.value)}
              className="text-sm h-8 bg-neutral-900 border-neutral-700"
            />
            <Input
              type="date"
              placeholder="Next touch date"
              value={touchNextTouchAt}
              onChange={(e) => setTouchNextTouchAt(e.target.value)}
              className="text-sm h-8 bg-neutral-900 border-neutral-700"
            />
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Script used (optional)</label>
              <select
                value={touchScriptUsed}
                onChange={(e) => setTouchScriptUsed(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-900 text-sm px-2 py-1.5 w-full"
              >
                <option value="">—</option>
                {SALES_SCRIPTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={submitTouch} disabled={savingTouch || !touchSummary.trim()}>
              {savingTouch ? "Saving…" : "Save touch"}
            </Button>
          </div>
        )}
        {touches.length > 0 && (
          <ul className="mt-2 space-y-1.5 text-sm">
            {touches.slice(0, 10).map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-2 border-b border-neutral-800/50 pb-1.5">
                <span className="text-neutral-500 text-xs">{new Date(t.createdAt).toLocaleString()}</span>
                <Badge variant="outline" className="text-[10px]">{t.type.replace(/_/g, " ")}</Badge>
                <span className="text-neutral-300">{t.summary.slice(0, 80)}{t.summary.length > 80 ? "…" : ""}</span>
                {t.outcome && <span className="text-neutral-500 text-xs">→ {t.outcome}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Referral */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-neutral-500">Referral ask: </span>
          <select
            value={referralAskStatus ?? "none"}
            onChange={(e) => updateField("referralAskStatus", e.target.value === "none" ? null : e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 text-sm px-2 py-1"
          >
            {REFERRAL_ASK_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">Referrals: {referralCount}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowReferralForm((v) => !v)}
          >
            {showReferralForm ? "Cancel" : "Log referral"}
          </Button>
        </div>
        {showReferralForm && (
          <div className="border border-neutral-700 rounded-md p-3 space-y-2 bg-neutral-900/50">
            <Input
              placeholder="Referred name (required)"
              value={refName}
              onChange={(e) => setRefName(e.target.value)}
              className="text-sm h-8 bg-neutral-900 border-neutral-700"
            />
            <Input
              placeholder="Company (optional)"
              value={refCompany}
              onChange={(e) => setRefCompany(e.target.value)}
              className="text-sm h-8 bg-neutral-900 border-neutral-700"
            />
            <Button size="sm" onClick={submitReferral} disabled={savingRef || !refName.trim()}>
              {savingRef ? "Saving…" : "Save referral"}
            </Button>
          </div>
        )}
        {referralsReceived.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-neutral-300">
            {referralsReceived.map((r) => (
              <li key={r.id}>
                {r.referredName}
                {r.referredCompany && ` · ${r.referredCompany}`}
                <span className="text-neutral-500 text-xs ml-1">({r.status})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Relationship maintenance */}
      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Relationship status</label>
          <select
            value={relationshipStatus ?? ""}
            onChange={(e) => updateField("relationshipStatus", e.target.value || null)}
            className="rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 px-2 py-1.5 w-full text-sm"
          >
            <option value="">—</option>
            {RELATIONSHIP_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Last check-in</label>
          <Input
            type="date"
            value={relationshipLastCheck ? relationshipLastCheck.slice(0, 10) : ""}
            onChange={(e) => updateDateField("relationshipLastCheck", e.target.value || null)}
            className="h-8 text-sm bg-neutral-900 border-neutral-700"
          />
        </div>
      </div>
    </div>
  );
}
