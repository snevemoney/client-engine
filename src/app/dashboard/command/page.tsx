import { buildBrief } from "@/lib/orchestrator/brief";
import { getQueueSummary } from "@/lib/ops/queueSummary";
import { getConstraintSnapshot } from "@/lib/ops/constraint";
import { getLatestOperatorBrief } from "@/lib/ops/operatorBrief";
import { getRecentOperatorFeedbackNotes } from "@/lib/ops/feedback";
import { getLearningInboxSummary } from "@/lib/learning/ingest";
import { getKnowledgeQueueCounts, getTopImprovementSuggestions } from "@/lib/knowledge/ingest";
import { getMoneyScorecard } from "@/lib/ops/moneyScorecard";
import { getSalesLeakReport } from "@/lib/ops/salesLeak";
import { getFailuresAndInterventions } from "@/lib/ops/failuresInterventions";
import { getLeverageScore } from "@/lib/ops/leverageScore";
import { getWeeklySnapshotHistory } from "@/lib/ops/weeklySnapshot";
import { getOperatorSettings } from "@/lib/ops/settings";
import { getPatTomWeeklyScorecard } from "@/lib/ops/patTomWeeklyScorecard";
import { db } from "@/lib/db";
import { CommandHeader } from "@/components/dashboard/command/CommandHeader";
import { WorkdayRunCard } from "@/components/dashboard/command/WorkdayRunCard";
import { BriefMeCard } from "@/components/dashboard/command/BriefMeCard";
import { QueueSummaryCard } from "@/components/dashboard/command/QueueSummaryCard";
import { ConstraintCard } from "@/components/dashboard/command/ConstraintCard";
import { AiBriefCard } from "@/components/dashboard/command/AiBriefCard";
import { FailuresInterventionsCard } from "@/components/dashboard/command/FailuresInterventionsCard";
import { LeverageScoreCard } from "@/components/dashboard/command/LeverageScoreCard";
import { LeverageTrendCard } from "@/components/dashboard/command/LeverageTrendCard";
import { GraduationTriggerCard } from "@/components/dashboard/command/GraduationTriggerCard";
import { QuickActionsCard } from "@/components/dashboard/command/QuickActionsCard";
import { TodaysFlowCard } from "@/components/dashboard/command/TodaysFlowCard";
import { FeedbackCard } from "@/components/dashboard/command/FeedbackCard";
import { TodaysAIActivityCard } from "@/components/dashboard/command/TodaysAIActivityCard";
import { TopOpportunitiesCard } from "@/components/dashboard/command/TopOpportunitiesCard";
import { LearningInboxCard } from "@/components/dashboard/command/LearningInboxCard";
import { KnowledgeQueueCard } from "@/components/dashboard/command/KnowledgeQueueCard";
import { TopSuggestionsCard } from "@/components/dashboard/command/TopSuggestionsCard";
import { MoneyScorecardCard } from "@/components/dashboard/command/MoneyScorecardCard";
import { SalesLeakCard } from "@/components/dashboard/command/SalesLeakCard";
import { PatTomWeeklyScorecardCard } from "@/components/dashboard/command/PatTomWeeklyScorecardCard";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const [brief, queue, constraint, lastRunReport, latestBrief, failuresInterventions, leverageScore, weeklyTrend, operatorSettings, patTomScorecard, feedbackNotes, learningInbox, knowledgeQueue, topSuggestions, moneyScorecard, salesLeakReport] = await Promise.all([
    buildBrief(),
    getQueueSummary(),
    getConstraintSnapshot(),
    db.artifact.findFirst({
      where: {
        lead: { source: "system", title: "Research Engine Runs" },
        title: "WORKDAY_RUN_REPORT",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, content: true },
    }),
    getLatestOperatorBrief(),
    getFailuresAndInterventions(),
    getLeverageScore(),
    getWeeklySnapshotHistory(8),
    getOperatorSettings(),
    getPatTomWeeklyScorecard(),
    getRecentOperatorFeedbackNotes(5),
    getLearningInboxSummary(),
    getKnowledgeQueueCounts(),
    getTopImprovementSuggestions(5),
    getMoneyScorecard(),
    getSalesLeakReport(),
  ]);

  const feedbackNoteItems = feedbackNotes.map((n) => ({
    id: n.id,
    content: n.content,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <CommandHeader />

      <MoneyScorecardCard data={moneyScorecard} />

      <SalesLeakCard data={salesLeakReport} />

      <FailuresInterventionsCard data={failuresInterventions} />

      <PatTomWeeklyScorecardCard data={patTomScorecard} />

      <div className="grid gap-4 sm:grid-cols-2">
        <LeverageScoreCard data={leverageScore} />
        <TodaysFlowCard queue={queue} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <LeverageTrendCard history={weeklyTrend} />
        <GraduationTriggerCard
          dealsWon90d={moneyScorecard.dealsWon90d ?? 0}
          targetWins={operatorSettings.graduationTargetWins ?? null}
          milestone={operatorSettings.graduationMilestone ?? null}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <WorkdayRunCard lastRunAt={lastRunReport?.createdAt?.toISOString() ?? null} />
        <BriefMeCard initialBrief={latestBrief} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TodaysAIActivityCard
          lastRunContent={lastRunReport?.content ?? null}
          lastRunAt={lastRunReport?.createdAt?.toISOString() ?? null}
        />
        <TopOpportunitiesCard
          nextActions={brief.nextActions}
          qualifiedLeads={brief.qualifiedLeads}
        />
      </div>
      <QueueSummaryCard queue={queue} />
      <ConstraintCard constraint={constraint} />
      <AiBriefCard latestBrief={latestBrief} />
      <LearningInboxCard proposalCount={learningInbox.proposalCount} latestSource={learningInbox.latestSource} />
      <div className="grid gap-4 sm:grid-cols-2">
        <KnowledgeQueueCard
          transcriptsToday={knowledgeQueue.transcriptsToday}
          insightsToday={knowledgeQueue.insightsToday}
          suggestionsToday={knowledgeQueue.suggestionsToday}
          suggestionQueuedTotal={knowledgeQueue.suggestionQueuedTotal}
        />
        <TopSuggestionsCard
          suggestions={topSuggestions.map((s) => ({ ...s, createdAt: s.createdAt }))}
        />
      </div>
      <QuickActionsCard />
      <FeedbackCard initialNotes={feedbackNoteItems} />
    </div>
  );
}
