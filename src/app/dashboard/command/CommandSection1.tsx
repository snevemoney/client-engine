import {
  getCachedMoneyScorecard,
  getCachedOpsHealth,
  getCachedSalesLeakReport,
  getCachedCurrentStrategyWeek,
} from "@/lib/ops/cached";
import { OpsHealthGatewayCard } from "@/components/dashboard/command/OpsHealthGatewayCard";
import { MoneyScorecardCard } from "@/components/dashboard/command/MoneyScorecardCard";
import { SalesLeakCard } from "@/components/dashboard/command/SalesLeakCard";
import { StrategySnapshotCard } from "@/components/dashboard/command/StrategySnapshotCard";
import { logSlow, PERF } from "@/lib/perf";

/** First wave: ops health + money + sales leak + strategy. Shows as soon as these fetches complete. */
export default async function CommandSection1() {
  const start = performance.now(); // eslint-disable-line react-hooks/purity -- timing for observability
  const [opsHealth, moneyScorecard, salesLeakReport, strategyWeek] = await Promise.all([
    getCachedOpsHealth(),
    getCachedMoneyScorecard(),
    getCachedSalesLeakReport(),
    getCachedCurrentStrategyWeek(),
  ]);
  const ms = Math.round(performance.now() - start); // eslint-disable-line react-hooks/purity

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <OpsHealthGatewayCard
          summary={{
            workdayStatus: opsHealth.workdayRun.status,
            totalCount: opsHealth.failuresAndInterventions.totalCount,
            approvalQueueCount: opsHealth.approvalQueueCount,
          }}
        />
        <StrategySnapshotCard data={strategyWeek} />
      </div>
      <MoneyScorecardCard data={moneyScorecard} />
      <SalesLeakCard data={salesLeakReport} />
    </>
  );
}
