"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OperatorSettings, ScoringProfile } from "@/lib/ops/settings";

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-sm text-neutral-200">{label}</div>
        {description && <div className="text-xs text-neutral-500 mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-emerald-600" : "bg-neutral-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function NumberField({
  label,
  description,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className="py-2">
      <label className="text-sm text-neutral-200 block mb-1">{label}</label>
      {description && <div className="text-xs text-neutral-500 mb-2">{description}</div>}
      <div className="flex items-center gap-2">
        <Input
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-[120px] bg-neutral-900 border-neutral-700"
        />
        {suffix && <span className="text-xs text-neutral-500">{suffix}</span>}
      </div>
    </div>
  );
}

export function OperatorSettingsPanel({
  initialSettings,
  researchEnabled: envResearchEnabled,
}: {
  initialSettings: OperatorSettings;
  researchEnabled: boolean;
}) {
  const [workdayOn, setWorkdayOn] = useState(
    initialSettings.workdayEnabled ?? envResearchEnabled
  );
  const [interval, setInterval_] = useState(
    String(initialSettings.workdayIntervalMinutes ?? 60)
  );
  const [maxLeads, setMaxLeads] = useState(
    String(initialSettings.workdayMaxLeadsPerRun ?? 20)
  );
  const [maxRuns, setMaxRuns] = useState(
    String(initialSettings.workdayMaxRunsPerDay ?? 4)
  );

  const [niche, setNiche] = useState(initialSettings.nicheStatement ?? "");
  const [offer, setOffer] = useState(initialSettings.offerStatement ?? "");
  const [buyer, setBuyer] = useState(initialSettings.buyerProfile ?? "");

  const sp = initialSettings.scoringProfile ?? {};
  const [scoreIdeal, setScoreIdeal] = useState(sp.idealProjects ?? "");
  const [scoreBudget, setScoreBudget] = useState(sp.budgetRange ?? "");
  const [scoreTimeline, setScoreTimeline] = useState(sp.typicalTimeline ?? "");
  const [scoreTech, setScoreTech] = useState(sp.techStack ?? "");
  const [scorePrefers, setScorePrefers] = useState(sp.prefers ?? "");
  const [scoreAvoids, setScoreAvoids] = useState(sp.avoids ?? "");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const parse = (s: string) => {
      const n = parseInt(s.replace(/\D/g, ""), 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    try {
      const res = await fetch("/api/ops/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...initialSettings,
          workdayEnabled: workdayOn,
          workdayIntervalMinutes: parse(interval),
          workdayMaxLeadsPerRun: parse(maxLeads),
          workdayMaxRunsPerDay: parse(maxRuns),
          nicheStatement: niche.trim() || undefined,
          offerStatement: offer.trim() || undefined,
          buyerProfile: buyer.trim() || undefined,
          scoringProfile: {
            idealProjects: scoreIdeal.trim() || undefined,
            budgetRange: scoreBudget.trim() || undefined,
            typicalTimeline: scoreTimeline.trim() || undefined,
            techStack: scoreTech.trim() || undefined,
            prefers: scorePrefers.trim() || undefined,
            avoids: scoreAvoids.trim() || undefined,
          } as ScoringProfile,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMessage(data?.error ?? "Save failed");
        return;
      }
      setMessage("Saved!");
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Automation */}
      <section className="border border-neutral-800 rounded-lg p-6 space-y-2">
        <h2 className="text-base font-medium text-neutral-200">Automation</h2>
        <p className="text-xs text-neutral-500 mb-3">
          Controls how the system finds leads, enriches them, and prepares proposals automatically.
        </p>

        <Toggle
          label="Daily automation"
          description="Automatically find new leads, research them, score, and draft proposals"
          checked={workdayOn}
          onChange={setWorkdayOn}
        />

        {workdayOn && (
          <div className="pl-1 border-l-2 border-neutral-800 ml-2 space-y-1">
            <NumberField
              label="Run every"
              description="How often the system checks for new leads"
              value={interval}
              onChange={setInterval_}
              placeholder="60"
              suffix="minutes"
            />
            <NumberField
              label="Leads per run"
              description="Max number of leads to process each time"
              value={maxLeads}
              onChange={setMaxLeads}
              placeholder="20"
            />
            <NumberField
              label="Runs per day"
              description="Limit total automation runs per day"
              value={maxRuns}
              onChange={setMaxRuns}
              placeholder="4"
            />
          </div>
        )}
      </section>

      {/* Safety */}
      <section className="border border-amber-900/40 rounded-lg p-6 space-y-3 bg-amber-950/10">
        <h2 className="text-base font-medium text-amber-200/90">Safety controls</h2>
        <p className="text-xs text-neutral-500">
          These are always locked. The system drafts proposals and researches leads, but you always decide what gets sent.
        </p>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-neutral-300">Send proposals automatically</span>
            <span className="text-amber-400 font-medium">Always off</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-300">Start builds automatically</span>
            <span className="text-amber-400 font-medium">Always off</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-300">Your approval required before</span>
            <span className="text-neutral-400">Sending proposals, starting builds</span>
          </div>
        </div>
      </section>

      {/* Business profile */}
      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <h2 className="text-base font-medium text-neutral-200">Your business</h2>
        <p className="text-xs text-neutral-500">
          Helps the system write better proposals and find the right leads for you.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-neutral-300 block mb-1">Who you help</label>
            <Input
              placeholder="e.g. Small business owners who need a website"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
          <div>
            <label className="text-sm text-neutral-300 block mb-1">What you offer</label>
            <Input
              placeholder="e.g. Custom websites and web apps"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
          <div>
            <label className="text-sm text-neutral-300 block mb-1">Ideal client</label>
            <Input
              placeholder="e.g. Growing companies with $5k-$20k budget"
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
        </div>
      </section>

      {/* Scoring profile — configurable, niche-agnostic */}
      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <h2 className="text-base font-medium text-neutral-200">Scoring profile</h2>
        <p className="text-xs text-neutral-500">
          Used by the pipeline to score leads. Update when you change niche — no code changes needed.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm text-neutral-400 block mb-1">Ideal projects</label>
            <Input
              placeholder="e.g. web apps, dashboards, booking systems"
              value={scoreIdeal}
              onChange={(e) => setScoreIdeal(e.target.value)}
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
          <div>
            <label className="text-sm text-neutral-400 block mb-1">Budget range</label>
            <Input
              placeholder="e.g. $1,000-$10,000"
              value={scoreBudget}
              onChange={(e) => setScoreBudget(e.target.value)}
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
          <div>
            <label className="text-sm text-neutral-400 block mb-1">Typical timeline</label>
            <Input
              placeholder="e.g. 1-4 weeks"
              value={scoreTimeline}
              onChange={(e) => setScoreTimeline(e.target.value)}
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
          <div>
            <label className="text-sm text-neutral-400 block mb-1">Tech stack</label>
            <Input
              placeholder="e.g. Next.js, React, PostgreSQL"
              value={scoreTech}
              onChange={(e) => setScoreTech(e.target.value)}
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
        </div>
        <div>
          <label className="text-sm text-neutral-400 block mb-1">Prefers</label>
          <Input
            placeholder="e.g. clear scope, responsive clients, repeat potential"
            value={scorePrefers}
            onChange={(e) => setScorePrefers(e.target.value)}
            className="bg-neutral-900 border-neutral-700"
          />
        </div>
        <div>
          <label className="text-sm text-neutral-400 block mb-1">Avoids</label>
          <Input
            placeholder="e.g. maintenance-only, vague requests"
            value={scoreAvoids}
            onChange={(e) => setScoreAvoids(e.target.value)}
            className="bg-neutral-900 border-neutral-700"
          />
        </div>
      </section>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        {message && (
          <span className={`text-sm ${message === "Saved!" ? "text-emerald-400" : "text-amber-400"}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
