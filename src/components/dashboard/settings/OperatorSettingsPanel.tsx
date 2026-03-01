"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { OperatorSettings, ScoringProfile } from "@/lib/ops/settings";

/* ── Helper components ──────────────────────────────────────────── */

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
  recommended,
  onAccept,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  recommended?: string;
  onAccept?: () => void;
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
        {recommended && recommended !== value && (
          <button
            type="button"
            onClick={onAccept}
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
          >
            <Sparkles className="w-3 h-3" /> AI suggests: {recommended}
          </button>
        )}
      </div>
    </div>
  );
}

function SmartField({
  label,
  placeholder,
  value,
  onChange,
  recommended,
  onAccept,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  recommended?: string;
  onAccept?: () => void;
}) {
  const hasRecommendation = recommended && recommended !== value;
  return (
    <div>
      <label className="text-sm text-neutral-300 block mb-1">{label}</label>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-neutral-900 border-neutral-700 ${hasRecommendation ? "border-amber-800/50" : ""}`}
      />
      {hasRecommendation && (
        <button
          type="button"
          onClick={onAccept}
          className="mt-1.5 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors group"
        >
          <Sparkles className="w-3 h-3" />
          <span className="group-hover:underline">{recommended}</span>
          <Check className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}
    </div>
  );
}

/* ── Types ───────────────────────────────────────────────────── */

type Recommendations = {
  nicheStatement?: string;
  offerStatement?: string;
  buyerProfile?: string;
  scoringProfile?: {
    idealProjects?: string;
    budgetRange?: string;
    typicalTimeline?: string;
    techStack?: string;
    prefers?: string;
    avoids?: string;
  };
  workdayIntervalMinutes?: number;
  workdayMaxLeadsPerRun?: number;
  workdayMaxRunsPerDay?: number;
  reasoning?: string;
};

/* ── Main Panel ────────────────────────────────────────────── */

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
  const [dirty, setDirty] = useState(false);
  const mountedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI recommendations state
  const [recs, setRecs] = useState<Recommendations | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  // Build the save payload from current state
  const buildPayload = useCallback(() => {
    const parse = (s: string) => {
      const n = parseInt(s.replace(/\D/g, ""), 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    return {
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
    };
  }, [initialSettings, workdayOn, interval, maxLeads, maxRuns, niche, offer, buyer, scoreIdeal, scoreBudget, scoreTimeline, scoreTech, scorePrefers, scoreAvoids]);

  // Auto-save: debounce 2s after any field change
  useEffect(() => {
    // Skip on first render (mount)
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setDirty(true);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void doSave();
    }, 2000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workdayOn, interval, maxLeads, maxRuns, niche, offer, buyer, scoreIdeal, scoreBudget, scoreTimeline, scoreTech, scorePrefers, scoreAvoids]);

  async function doSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ops/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMessage(data?.error ?? "Save failed");
        return;
      }
      setDirty(false);
      setMessage("Saved!");
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function fetchRecommendations() {
    setRecsLoading(true);
    setRecsError(null);
    try {
      const res = await fetch("/api/ops/settings/recommend", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setRecsError(d?.error ?? "Failed to generate recommendations");
        return;
      }
      const data = await res.json();
      setRecs(data.recommendations);
    } catch (e) {
      setRecsError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRecsLoading(false);
    }
  }

  function acceptAllRecommendations() {
    if (!recs) return;
    if (recs.nicheStatement) setNiche(recs.nicheStatement);
    if (recs.offerStatement) setOffer(recs.offerStatement);
    if (recs.buyerProfile) setBuyer(recs.buyerProfile);
    if (recs.scoringProfile?.idealProjects) setScoreIdeal(recs.scoringProfile.idealProjects);
    if (recs.scoringProfile?.budgetRange) setScoreBudget(recs.scoringProfile.budgetRange);
    if (recs.scoringProfile?.typicalTimeline) setScoreTimeline(recs.scoringProfile.typicalTimeline);
    if (recs.scoringProfile?.techStack) setScoreTech(recs.scoringProfile.techStack);
    if (recs.scoringProfile?.prefers) setScorePrefers(recs.scoringProfile.prefers);
    if (recs.scoringProfile?.avoids) setScoreAvoids(recs.scoringProfile.avoids);
    if (recs.workdayIntervalMinutes) setInterval_(String(recs.workdayIntervalMinutes));
    if (recs.workdayMaxLeadsPerRun) setMaxLeads(String(recs.workdayMaxLeadsPerRun));
    if (recs.workdayMaxRunsPerDay) setMaxRuns(String(recs.workdayMaxRunsPerDay));
    setMessage("Recommendations applied — review and save when ready");
    setTimeout(() => setMessage(null), 5000);
  }

  // Manual save (also used by the button)
  async function save() {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    await doSave();
  }

  const recSp = recs?.scoringProfile;

  return (
    <div className="space-y-8">
      {/* AI Recommendations Banner */}
      <section className="border border-amber-800/40 rounded-lg p-5 bg-gradient-to-br from-amber-950/20 to-neutral-900/50 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-medium text-amber-200/90">AI-Powered Settings</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Analyzes your pipeline data, deal history, and chat conversations to recommend optimal settings.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {recs && (
              <Button
                variant="outline"
                size="sm"
                onClick={acceptAllRecommendations}
                className="text-amber-400 border-amber-800/50 hover:bg-amber-900/30"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Accept all
              </Button>
            )}
            <Button
              size="sm"
              onClick={fetchRecommendations}
              disabled={recsLoading}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {recsLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  {recs ? "Refresh" : "Get AI recommendations"}
                </>
              )}
            </Button>
          </div>
        </div>

        {recsError && (
          <p className="text-xs text-red-400">{recsError}</p>
        )}

        {recs?.reasoning && (
          <div>
            <button
              type="button"
              onClick={() => setShowReasoning(!showReasoning)}
              className="text-xs text-neutral-400 hover:text-neutral-300 flex items-center gap-1 transition-colors"
            >
              {showReasoning ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              AI reasoning
            </button>
            {showReasoning && (
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed border-l-2 border-amber-800/30 pl-3">
                {recs.reasoning}
              </p>
            )}
          </div>
        )}

        {recs && (
          <p className="text-[10px] text-neutral-500">
            Click individual suggestions below to accept them, or use &ldquo;Accept all&rdquo; above. Nothing is saved until you hit Save.
          </p>
        )}
      </section>

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
              recommended={recs?.workdayIntervalMinutes ? String(recs.workdayIntervalMinutes) : undefined}
              onAccept={() => recs?.workdayIntervalMinutes && setInterval_(String(recs.workdayIntervalMinutes))}
            />
            <NumberField
              label="Leads per run"
              description="Max number of leads to process each time"
              value={maxLeads}
              onChange={setMaxLeads}
              placeholder="20"
              recommended={recs?.workdayMaxLeadsPerRun ? String(recs.workdayMaxLeadsPerRun) : undefined}
              onAccept={() => recs?.workdayMaxLeadsPerRun && setMaxLeads(String(recs.workdayMaxLeadsPerRun))}
            />
            <NumberField
              label="Runs per day"
              description="Limit total automation runs per day"
              value={maxRuns}
              onChange={setMaxRuns}
              placeholder="4"
              recommended={recs?.workdayMaxRunsPerDay ? String(recs.workdayMaxRunsPerDay) : undefined}
              onAccept={() => recs?.workdayMaxRunsPerDay && setMaxRuns(String(recs.workdayMaxRunsPerDay))}
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-neutral-200">Your business</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Helps the system write better proposals and find the right leads for you.
            </p>
          </div>
          {recs && (recs.nicheStatement || recs.offerStatement || recs.buyerProfile) && (
            <span className="text-[10px] text-amber-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI suggestions available
            </span>
          )}
        </div>
        <div className="space-y-3">
          <SmartField
            label="Who you help"
            placeholder="e.g. Small business owners who need a website"
            value={niche}
            onChange={setNiche}
            recommended={recs?.nicheStatement}
            onAccept={() => recs?.nicheStatement && setNiche(recs.nicheStatement)}
          />
          <SmartField
            label="What you offer"
            placeholder="e.g. Custom websites and web apps"
            value={offer}
            onChange={setOffer}
            recommended={recs?.offerStatement}
            onAccept={() => recs?.offerStatement && setOffer(recs.offerStatement)}
          />
          <SmartField
            label="Ideal client"
            placeholder="e.g. Growing companies with $5k-$20k budget"
            value={buyer}
            onChange={setBuyer}
            recommended={recs?.buyerProfile}
            onAccept={() => recs?.buyerProfile && setBuyer(recs.buyerProfile)}
          />
        </div>
      </section>

      {/* Scoring profile */}
      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-neutral-200">Scoring profile</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Used by the pipeline to score leads. Update when you change niche — no code changes needed.
            </p>
          </div>
          {recSp && (
            <span className="text-[10px] text-amber-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI suggestions available
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SmartField
            label="Ideal projects"
            placeholder="e.g. web apps, dashboards, booking systems"
            value={scoreIdeal}
            onChange={setScoreIdeal}
            recommended={recSp?.idealProjects}
            onAccept={() => recSp?.idealProjects && setScoreIdeal(recSp.idealProjects)}
          />
          <SmartField
            label="Budget range"
            placeholder="e.g. $1,000-$10,000"
            value={scoreBudget}
            onChange={setScoreBudget}
            recommended={recSp?.budgetRange}
            onAccept={() => recSp?.budgetRange && setScoreBudget(recSp.budgetRange)}
          />
          <SmartField
            label="Typical timeline"
            placeholder="e.g. 1-4 weeks"
            value={scoreTimeline}
            onChange={setScoreTimeline}
            recommended={recSp?.typicalTimeline}
            onAccept={() => recSp?.typicalTimeline && setScoreTimeline(recSp.typicalTimeline)}
          />
          <SmartField
            label="Tech stack"
            placeholder="e.g. Next.js, React, PostgreSQL"
            value={scoreTech}
            onChange={setScoreTech}
            recommended={recSp?.techStack}
            onAccept={() => recSp?.techStack && setScoreTech(recSp.techStack)}
          />
        </div>
        <SmartField
          label="Prefers"
          placeholder="e.g. clear scope, responsive clients, repeat potential"
          value={scorePrefers}
          onChange={setScorePrefers}
          recommended={recSp?.prefers}
          onAccept={() => recSp?.prefers && setScorePrefers(recSp.prefers)}
        />
        <SmartField
          label="Avoids"
          placeholder="e.g. maintenance-only, vague requests"
          value={scoreAvoids}
          onChange={setScoreAvoids}
          recommended={recSp?.avoids}
          onAccept={() => recSp?.avoids && setScoreAvoids(recSp.avoids)}
        />
      </section>

      {/* Save bar — sticky at bottom */}
      <div className="sticky bottom-0 py-3 bg-neutral-950/90 backdrop-blur border-t border-neutral-800 -mx-6 px-6 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        {saving && (
          <span className="text-sm text-neutral-500 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
          </span>
        )}
        {!saving && message && (
          <span className={`text-sm ${message === "Saved!" ? "text-emerald-400" : "text-amber-400"}`}>
            {message}
          </span>
        )}
        {!saving && !message && dirty && (
          <span className="text-sm text-amber-400/70">Unsaved changes — auto-saving in 2s</span>
        )}
      </div>
    </div>
  );
}
