import Link from "next/link";
import { db } from "@/lib/db";
import { getOperatorSettings } from "@/lib/ops/settings";
import { getMonetizationMap } from "@/lib/ops/monetization";
import { MonetizationMapSection } from "@/components/dashboard/settings/MonetizationMapSection";
import { CashAndGraduationSection } from "@/components/dashboard/settings/CashAndGraduationSection";
import { IntegrationsSection } from "@/components/dashboard/settings/IntegrationsSection";

export const dynamic = "force-dynamic";

function mask(value: string | undefined): string {
  if (!value) return "—";
  if (value.length <= 4) return "••••";
  return value.slice(0, 2) + "••••" + value.slice(-2);
}

export default async function SettingsPage() {
  const [operatorSettings, lastWorkdayRun, lastBriefing, monetizationMap, projects] = await Promise.all([
    getOperatorSettings(),
    db.artifact.findFirst({
      where: {
        lead: { source: "system", title: "Research Engine Runs" },
        title: "WORKDAY_RUN_REPORT",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.artifact.findFirst({
      where: {
        lead: { source: "system", title: "Research Engine Runs" },
        type: "operator_briefing",
        title: "OPERATOR_BRIEFING",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    getMonetizationMap(),
    db.project.findMany({ select: { id: true, slug: true, name: true, status: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  const researchEnabled =
    process.env.RESEARCH_ENABLED === "1" || process.env.RESEARCH_ENABLED === "true";
  const feedUrl = process.env.RESEARCH_FEED_URL;
  const limitPerRun = process.env.RESEARCH_LIMIT_PER_RUN ?? "10";
  const workdayEnabled = operatorSettings.workdayEnabled ?? researchEnabled;
  const workdayInterval = (operatorSettings.workdayIntervalMinutes ?? Number(process.env.WORKDAY_INTERVAL_MINUTES)) || 60;
  const workdayMaxLeads = (operatorSettings.workdayMaxLeadsPerRun ?? Number(process.env.RESEARCH_LIMIT_PER_RUN)) || 20;
  const workdayMaxRuns = (operatorSettings.workdayMaxRunsPerDay ?? Number(process.env.WORKDAY_MAX_RUNS_PER_DAY)) || 4;
  const workdayRunStale = !lastWorkdayRun?.createdAt
    // eslint-disable-next-line react-hooks/purity -- server component, runs once per request
    || (Date.now() - new Date(lastWorkdayRun.createdAt).getTime() > 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-neutral-400 mt-1">System configuration and operator controls.</p>
      </div>

      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-medium text-neutral-300">Research Engine</h2>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Enabled</span>
            <span className={researchEnabled ? "text-emerald-400" : "text-amber-400"}>
              {researchEnabled ? "ON" : "OFF"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Feed configured</span>
            <span>{feedUrl ? "Yes" : "No"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Limit per run</span>
            <span>{limitPerRun}</span>
          </div>
        </div>
        <p className="text-xs text-neutral-500">
          Set RESEARCH_ENABLED=1, RESEARCH_FEED_URL, RESEARCH_LIMIT_PER_RUN in environment.
        </p>
      </section>

      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-medium text-neutral-300">Workday automation</h2>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Workday mode enabled</span>
            <span className={workdayEnabled ? "text-emerald-400" : "text-amber-400"}>
              {workdayEnabled ? "ON" : "OFF"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Run interval (minutes)</span>
            <span>{workdayInterval}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Max leads per run</span>
            <span>{workdayMaxLeads}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Max runs per day</span>
            <span>{workdayMaxRuns}</span>
          </div>
          {(operatorSettings.quietHoursStart != null || operatorSettings.quietHoursEnd != null) && (
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Quiet hours</span>
              <span>{operatorSettings.quietHoursEnd ?? "?"}–{operatorSettings.quietHoursStart ?? "?"}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          Override via OPERATOR_SETTINGS artifact or env: WORKDAY_INTERVAL_MINUTES, WORKDAY_MAX_RUNS_PER_DAY. Cron calls POST /api/ops/workday-run.
        </p>
      </section>

      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-medium text-neutral-300">Safety (locked)</h2>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Auto-send proposals</span>
            <span className="text-amber-400">OFF</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Auto-build</span>
            <span className="text-amber-400">OFF</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Approval gates</span>
            <span className="text-neutral-400">Required for send and build</span>
          </div>
        </div>
      </section>

      <section className="border border-amber-900/40 rounded-lg p-6 space-y-4 bg-amber-950/10">
        <h2 className="text-sm font-medium text-amber-200/90">Autopilot guardrails</h2>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Last workday run status</span>
            <span className={workdayRunStale ? "text-amber-400" : "text-emerald-400"}>
              {!lastWorkdayRun?.createdAt
                ? "Never run"
                : workdayRunStale
                  ? "No run in 24h — check cron"
                  : "OK"}
            </span>
          </div>
          <div>
            <div className="text-neutral-500 text-xs mb-1">Human-only (never automated)</div>
            <ul className="text-neutral-300 text-sm list-disc list-inside space-y-0.5">
              <li>Final proposal send</li>
              <li>Build start</li>
              <li>Positioning / offer changes</li>
              <li>Approve / reject lead</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-neutral-500">
          Automation runs research and pipeline only. Money-path steps always require your approval.
        </p>
      </section>

      <CashAndGraduationSection initialSettings={operatorSettings} />

      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-medium text-neutral-300">Business settings</h2>
        <div className="grid gap-3 text-sm">
          <div>
            <div className="text-neutral-500 text-xs mb-1">Niche / buyer</div>
            <p className="text-neutral-300 text-sm">
              {operatorSettings.nicheStatement || process.env.NICHE_STATEMENT || "—"}
            </p>
          </div>
          <div>
            <div className="text-neutral-500 text-xs mb-1">Offer statement</div>
            <p className="text-neutral-300 text-sm">
              {operatorSettings.offerStatement || process.env.OFFER_STATEMENT || "—"}
            </p>
          </div>
          <div>
            <div className="text-neutral-500 text-xs mb-1">Buyer profile</div>
            <p className="text-neutral-300 text-sm">
              {operatorSettings.buyerProfile || process.env.BUYER_PROFILE || "—"}
            </p>
          </div>
        </div>
        <p className="text-xs text-neutral-500">
          Set in OPERATOR_SETTINGS artifact (POST /api/ops/settings) or env: NICHE_STATEMENT, OFFER_STATEMENT, BUYER_PROFILE.
        </p>
      </section>

      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-medium text-neutral-300">Secrets / health (masked)</h2>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Cron secret present</span>
            <span>{process.env.RESEARCH_CRON_SECRET ? mask(process.env.RESEARCH_CRON_SECRET) : "—"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">OpenAI API key present</span>
            <span>{process.env.OPENAI_API_KEY ? mask(process.env.OPENAI_API_KEY) : "—"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Auth secret</span>
            <span>{process.env.AUTH_SECRET ? "Set" : "—"}</span>
          </div>
        </div>
        <Link href="/api/health" className="text-xs text-neutral-400 hover:text-white">
          Health endpoint →
        </Link>
      </section>

      <MonetizationMapSection initialProjects={projects} initialMap={monetizationMap} />

      <IntegrationsSection />

      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-medium text-neutral-300">Diagnostics</h2>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Last workday run</span>
            <span className="text-neutral-500">
              {lastWorkdayRun?.createdAt
                ? new Date(lastWorkdayRun.createdAt).toLocaleString()
                : "Never"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Last briefing</span>
            <span className="text-neutral-500">
              {lastBriefing?.createdAt
                ? new Date(lastBriefing.createdAt).toLocaleString()
                : "Never"}
            </span>
          </div>
        </div>
      </section>

      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <h2 className="text-sm font-medium text-neutral-300">Other</h2>
        <div>
          <h3 className="text-sm font-medium mb-1">OpenAI API Key</h3>
          <p className="text-xs text-neutral-500">Set via OPENAI_API_KEY on the server. Never displayed.</p>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-1">Capture API Key</h3>
          <p className="text-xs text-neutral-500">Set via CAPTURE_API_KEY. Used for URL capture endpoint.</p>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-1">Admin Email</h3>
          <p className="text-xs text-neutral-500">Set via ADMIN_EMAIL. Used for initial login.</p>
        </div>
      </section>
    </div>
  );
}
