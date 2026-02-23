import { getOpsHealth } from "@/lib/ops/opsHealth";
import { getCachedMoneyScorecard } from "@/lib/ops/cached";
import { getSalesLeakReport } from "@/lib/ops/salesLeak";
import { OpsHealthGatewayCard } from "@/components/dashboard/command/OpsHealthGatewayCard";
import { MoneyScorecardCard } from "@/components/dashboard/command/MoneyScorecardCard";
import { SalesLeakCard } from "@/components/dashboard/command/SalesLeakCard";

/** First wave: ops health + money + sales leak. Shows as soon as these 3 fetches complete. */
export default async function CommandSection1() {
  const [opsHealth, moneyScorecard, salesLeakReport] = await Promise.all([
    getOpsHealth(),
    getCachedMoneyScorecard(),
    getSalesLeakReport(),
  ]);

  return (
    <>
      <OpsHealthGatewayCard
        summary={{
          workdayStatus: opsHealth.workdayRun.status,
          totalCount: opsHealth.failuresAndInterventions.totalCount,
          approvalQueueCount: opsHealth.approvalQueueCount,
        }}
      />
      <MoneyScorecardCard data={moneyScorecard} />
      <SalesLeakCard data={salesLeakReport} />
    </>
  );
}
