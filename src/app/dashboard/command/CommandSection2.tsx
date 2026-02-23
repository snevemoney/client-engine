import { buildBrief } from "@/lib/orchestrator/brief";
import { getQueueSummary } from "@/lib/ops/queueSummary";
import { getCachedConstraintSnapshot, getCachedFailuresAndInterventions, getCachedMoneyScorecard, getCachedOperatorSettings } from "@/lib/ops/cached";
import { getLatestOperatorBrief } from "@/lib/ops/operatorBrief";
import { getRecentOperatorFeedbackNotes } from "@/lib/ops/feedback";
import { getLearningInboxSummary } from "@/lib/learning/ingest";
import { getKnowledgeQueueCounts, getTopImprovementSuggestions } from "@/lib/knowledge/ingest";
import { getFollowUpDisciplineMetrics } from "@/lib/ops/followUpDiscipline";
import { getReferralEngineMetrics } from "@/lib/ops/referralEngine";
import { getProspectingSourceMetrics } from "@/lib/ops/prospectingSources";
import { getChannelRoleCritique } from "@/lib/ops/channelRoleMap";
import { getBuildOpsSummary } from "@/lib/ops/buildTasks";
import { getReusableAssetSummary } from "@/lib/ops/reusableAssetSummary";
import { getLeverageScore } from "@/lib/ops/leverageScore";
import { getWeeklySnapshotHistory } from "@/lib/ops/weeklySnapshot";
import { getPatTomWeeklyScorecard } from "@/lib/ops/patTomWeeklyScorecard";
import { db } from "@/lib/db";
import { WorkdayRunCard } from "@/components/dashboard/command/WorkdayRunCard";
import { BriefMeCard } from "@/components/dashboard/command/BriefMeCard";
import { QueueSummaryCard } from "@/components/dashboard/command/QueueSummaryCard";
import { ConstraintCard } from "@/components/dashboard/command/ConstraintCard";
import { AiBriefCard } from "@/components/dashboard/command/AiBriefCard";
import { FailuresInterventionsCard } from "@/components/dashboard/command/FailuresInterventionsCard";
import { BuildOpsCard } from "@/components/dashboard/command/BuildOpsCard";
import { ReusableAssetSummaryCard } from "@/components/dashboard/command/ReusableAssetSummaryCard";
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
import { FollowUpDisciplineCard } from "@/components/dashboard/command/FollowUpDisciplineCard";
import { ReferralEngineCard } from "@/components/dashboard/command/ReferralEngineCard";
import { ProspectingSourcesCard } from "@/components/dashboard/command/ProspectingSourcesCard";
import { ChannelRoleCard } from "@/components/dashboard/command/ChannelRoleCard";
import { OwnedAudienceCard } from "@/components/dashboard/command/OwnedAudienceCard";
import { NetworkingEventsCard } from "@/components/dashboard/command/NetworkingEventsCard";
import { PatTomWeeklyScorecardCard } from "@/components/dashboard/command/PatTomWeeklyScorecardCard";

/** Second wave: all remaining cards. Streams in after Section 1. */
export default async function CommandSection2() {
  const [
    brief,
    queue,
    constraint,
    lastRunReport,
    latestBrief,
    failuresInterventions,
    buildOpsSummary,
    reusableAssetSummary,
    leverageScore,
    weeklyTrend,
    operatorSettings,
    patTomScorecard,
    feedbackNotes,
    learningInbox,
    knowledgeQueue,
    topSuggestions,
    moneyScorecard,
    followUpDiscipline,
    referralEngine,
    prospectingSources,
    channelRoleCritique,
  ] = await Promise.all([
    buildBrief(),
    getQueueSummary(),
    getCachedConstraintSnapshot(),
    db.artifact.findFirst({
      where: {
        lead: { source: "system", title: "Research Engine Runs" },
        title: "WORKDAY_RUN_REPORT",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, content: true },
    }),
    getLatestOperatorBrief(),
    getCachedFailuresAndInterventions(),
    getBuildOpsSummary(),
    getReusableAssetSummary(),
    getLeverageScore(),
    getWeeklySnapshotHistory(8),
    getCachedOperatorSettings(),
    getPatTomWeeklyScorecard(),
    getRecentOperatorFeedbackNotes(5),
    getLearningInboxSummary(),
    getKnowledgeQueueCounts(),
    getTopImprovementSuggestions(5),
    getCachedMoneyScorecard(),
    getFollowUpDisciplineMetrics(),
    getReferralEngineMetrics(),
    getProspectingSourceMetrics(),
    getChannelRoleCritique(),
  ]);

  const feedbackNoteItems = feedbackNotes.map((n) => ({
    id: n.id,
    content: n.content,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FollowUpDisciplineCard data={followUpDiscipline} />
        <ReferralEngineCard data={referralEngine} />
      </div>
      <ProspectingSourcesCard data={prospectingSources} />
      <ChannelRoleCard data={channelRoleCritique} />
      <OwnedAudienceCard />
      <NetworkingEventsCard />
      <FailuresInterventionsCard data={failuresInterventions} />
      <BuildOpsCard data={buildOpsSummary} />
      <ReusableAssetSummaryCard data={reusableAssetSummary} />
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
    </>
  );
}
