import { buildBrief } from "@/lib/orchestrator/brief";
import { getQueueSummary } from "@/lib/ops/queueSummary";
import { getConstraintSnapshot } from "@/lib/ops/constraint";
import { getLatestOperatorBrief } from "@/lib/ops/operatorBrief";
import { getRecentOperatorFeedbackNotes } from "@/lib/ops/feedback";
import { getLearningInboxSummary } from "@/lib/learning/ingest";
import { getKnowledgeQueueCounts, getTopImprovementSuggestions } from "@/lib/knowledge/ingest";
import { getMoneyScorecard } from "@/lib/ops/moneyScorecard";
import { db } from "@/lib/db";
import { CommandHeader } from "@/components/dashboard/command/CommandHeader";
import { WorkdayRunCard } from "@/components/dashboard/command/WorkdayRunCard";
import { BriefMeCard } from "@/components/dashboard/command/BriefMeCard";
import { QueueSummaryCard } from "@/components/dashboard/command/QueueSummaryCard";
import { ConstraintCard } from "@/components/dashboard/command/ConstraintCard";
import { AiBriefCard } from "@/components/dashboard/command/AiBriefCard";
import { RecentIssuesCard } from "@/components/dashboard/command/RecentIssuesCard";
import { QuickActionsCard } from "@/components/dashboard/command/QuickActionsCard";
import { TodaysFlowCard } from "@/components/dashboard/command/TodaysFlowCard";
import { FeedbackCard } from "@/components/dashboard/command/FeedbackCard";
import { TodaysAIActivityCard } from "@/components/dashboard/command/TodaysAIActivityCard";
import { TopOpportunitiesCard } from "@/components/dashboard/command/TopOpportunitiesCard";
import { LearningInboxCard } from "@/components/dashboard/command/LearningInboxCard";
import { KnowledgeQueueCard } from "@/components/dashboard/command/KnowledgeQueueCard";
import { TopSuggestionsCard } from "@/components/dashboard/command/TopSuggestionsCard";
import { MoneyScorecardCard } from "@/components/dashboard/command/MoneyScorecardCard";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const [brief, queue, constraint, lastRunReport, latestBrief, recentErrors, feedbackNotes, learningInbox, knowledgeQueue, topSuggestions, moneyScorecard] = await Promise.all([
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
    db.pipelineRun.findMany({
      where: { success: false },
      orderBy: { lastErrorAt: "desc" },
      take: 5,
      include: { lead: { select: { title: true } } },
    }),
    getRecentOperatorFeedbackNotes(5),
    getLearningInboxSummary(),
    getKnowledgeQueueCounts(),
    getTopImprovementSuggestions(5),
    getMoneyScorecard(),
  ]);

  const feedbackNoteItems = feedbackNotes.map((n) => ({
    id: n.id,
    content: n.content,
    createdAt: n.createdAt.toISOString(),
  }));

  const errorItems = recentErrors.map((r) => ({
    leadId: r.leadId,
    leadTitle: r.lead.title,
    code: r.lastErrorCode,
    at: r.lastErrorAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <CommandHeader />

      <MoneyScorecardCard data={moneyScorecard} />

      <TodaysFlowCard queue={queue} />

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
      <RecentIssuesCard errors={errorItems} />
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
