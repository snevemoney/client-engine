import { db } from "@/lib/db";
import { getOperatorSettings } from "@/lib/ops/settings";
import { getMonetizationMap } from "@/lib/ops/monetization";
import { MonetizationMapSection } from "@/components/dashboard/settings/MonetizationMapSection";
import { CashAndGraduationSection } from "@/components/dashboard/settings/CashAndGraduationSection";
import { IntegrationsSection } from "@/components/dashboard/settings/IntegrationsSection";
import { ApiUsageSection } from "@/components/dashboard/settings/ApiUsageSection";
import { OperatorSettingsPanel } from "@/components/dashboard/settings/OperatorSettingsPanel";

export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Manage how the system works for you — automation, business info, and connections.
        </p>
      </div>

      <OperatorSettingsPanel
        initialSettings={operatorSettings}
        researchEnabled={researchEnabled}
      />

      <CashAndGraduationSection initialSettings={operatorSettings} />

      <MonetizationMapSection initialProjects={projects} initialMap={monetizationMap} />

      <IntegrationsSection />

      <ApiUsageSection />

      {/* Activity overview */}
      <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <h2 className="text-base font-medium text-neutral-200">Recent activity</h2>
        <p className="text-xs text-neutral-500">
          Quick status of the system&apos;s last actions.
        </p>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Last automation run</span>
            <span className="text-neutral-300">
              {lastWorkdayRun?.createdAt
                ? new Date(lastWorkdayRun.createdAt).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })
                : "Not yet"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Last daily summary</span>
            <span className="text-neutral-300">
              {lastBriefing?.createdAt
                ? new Date(lastBriefing.createdAt).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })
                : "Not yet"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
