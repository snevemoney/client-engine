/**
 * Operator briefing: plain-English summary + structured payload.
 * Saves OPERATOR_BRIEFING artifact on system lead; used by Brief Me button.
 */

import { buildBrief } from "@/lib/orchestrator/brief";
import { getConstraintSnapshot } from "./constraint";
import { getTopImprovementSuggestions } from "@/lib/knowledge/ingest";
import { db } from "@/lib/db";
import { getOrCreateSystemLead } from "./systemLead";
import type { OperatorBrief } from "./types";

const ARTIFACT_TITLE = "OPERATOR_BRIEFING";

export async function generateOperatorBrief(): Promise<OperatorBrief> {
  const at = new Date().toISOString();
  const [brief, constraint, recentErrors, knowledgeSuggestions] = await Promise.all([
    buildBrief(),
    getConstraintSnapshot(),
    db.pipelineRun.findMany({
      where: { success: false },
      orderBy: { lastErrorAt: "desc" },
      take: 5,
      select: { leadId: true, lastErrorCode: true, lastErrorAt: true },
    }),
    getTopImprovementSuggestions(5),
  ]);

  const whatHappened: string[] = [];
  if (brief.qualifiedLeads.length > 0)
    whatHappened.push(`${brief.qualifiedLeads.length} qualified lead(s) worth your attention.`);
  if (brief.readyProposals.length > 0)
    whatHappened.push(`${brief.readyProposals.length} proposal(s) ready for review.`);
  if (brief.wins.length > 0) whatHappened.push(`${brief.wins.length} win(s) recorded.`);
  if (recentErrors.length > 0)
    whatHappened.push(`${recentErrors.length} pipeline run(s) failed recently.`);

  const whatWasCreated: string[] = [];
  if (brief.qualifiedLeads.length > 0)
    whatWasCreated.push(`Qualified leads: ${brief.qualifiedLeads.map((l) => l.title).slice(0, 3).join("; ")}${brief.qualifiedLeads.length > 3 ? "…" : ""}`);
  if (brief.readyProposals.length > 0)
    whatWasCreated.push(`Proposals ready: ${brief.readyProposals.map((l) => l.title).slice(0, 3).join("; ")}${brief.readyProposals.length > 3 ? "…" : ""}`);

  const whatFailed: string[] = recentErrors.map(
    (r) => `Lead ${r.leadId}: ${r.lastErrorCode ?? "error"} at ${r.lastErrorAt ? new Date(r.lastErrorAt).toLocaleString() : "—"}`
  );

  const needsApproval: string[] = [];
  for (const a of brief.nextActions) {
    needsApproval.push(`${a.title}: ${a.action}`);
  }

  const topOpportunities = brief.qualifiedLeads
    .slice(0, 5)
    .map((l) => `${l.title} (score ${l.score ?? "—"})`);
  const actionPlan = brief.nextActions.slice(0, 5).map((a) => `${a.action}: ${a.title}`);

  const summaryParts: string[] = [];
  summaryParts.push(`Brief for ${new Date(at).toLocaleString()}.`);
  if (brief.qualifiedLeads.length > 0)
    summaryParts.push(`${brief.qualifiedLeads.length} qualified leads.`);
  if (brief.readyProposals.length > 0)
    summaryParts.push(`${brief.readyProposals.length} proposals ready for review.`);
  if (brief.nextActions.length > 0)
    summaryParts.push(`${brief.nextActions.length} suggested next actions.`);
  if (constraint)
    summaryParts.push(`Constraint: ${constraint.label} — ${constraint.reason}`);
  const summary = summaryParts.join(" ");

  const fullText = [
    "# Operator Brief",
    "",
    summary,
    "",
    "## What happened",
    ...whatHappened.map((l) => `- ${l}`),
    "",
    "## What was created",
    ...(whatWasCreated.length ? whatWasCreated.map((l) => `- ${l}`) : ["- Nothing new in this window."]),
    "",
    "## What failed",
    ...(whatFailed.length ? whatFailed.map((l) => `- ${l}`) : ["- No recent failures."]),
    "",
    "## Needs your approval",
    ...(needsApproval.length ? needsApproval.map((l) => `- ${l}`) : ["- Nothing pending."]),
    "",
    constraint
      ? `## Bottleneck\n\n**${constraint.label}**\n\n${constraint.reason}\n\n**Do next:** ${constraint.recommendedActions.join("; ")}`
      : "",
    "",
    "## Top opportunities",
    ...topOpportunities.map((l) => `- ${l}`),
    "",
    "## 30-minute action plan",
    ...actionPlan.map((l) => `- ${l}`),
    knowledgeSuggestions.length > 0
      ? [
          "",
          "## Knowledge-derived improvement suggestions",
          "(From transcript learning; review in Knowledge dashboard. No auto-apply.)",
          ...knowledgeSuggestions.map((s) => `- **${s.title}** (${(s.meta as { systemArea?: string })?.systemArea ?? "—"}): ${s.content.slice(0, 120)}…`),
        ]
      : [],
  ]
    .flat()
    .filter(Boolean)
    .join("\n");

  const payload: OperatorBrief = {
    at,
    summary,
    whatHappened,
    whatWasCreated,
    whatFailed,
    needsApproval,
    bottleneck: constraint
      ? {
          label: constraint.label,
          reason: constraint.reason,
          actions: constraint.recommendedActions,
        }
      : null,
    topOpportunities,
    actionPlan,
    counts: {
      newLeads: brief.qualifiedLeads.length,
      proposalsReady: brief.readyProposals.length,
      approvalsNeeded: brief.nextActions.filter((a) => a.action.includes("proposal") || a.action.includes("build")).length,
      buildReady: brief.nextActions.filter((a) => a.action === "Start build").length,
      failedRuns: recentErrors.length,
    },
  };

  const systemLeadId = await getOrCreateSystemLead();
  await db.artifact.create({
    data: {
      leadId: systemLeadId,
      type: "operator_briefing",
      title: ARTIFACT_TITLE,
      content: fullText,
      meta: { at, counts: payload.counts },
    },
  });

  return payload;
}

/** Get the latest operator briefing (today or most recent). */
export async function getLatestOperatorBrief(): Promise<OperatorBrief | null> {
  const systemLead = await db.lead.findFirst({
    where: { source: "system", title: "Research Engine Runs" },
    select: { id: true },
  });
  if (!systemLead) return null;

  const artifact = await db.artifact.findFirst({
    where: { leadId: systemLead.id, type: "operator_briefing", title: ARTIFACT_TITLE },
    orderBy: { createdAt: "desc" },
  });
  if (!artifact || !artifact.meta || typeof artifact.meta !== "object") return null;

  const meta = artifact.meta as { at?: string; counts?: OperatorBrief["counts"] };
  const counts = meta.counts ?? {
    newLeads: 0,
    proposalsReady: 0,
    approvalsNeeded: 0,
    buildReady: 0,
    failedRuns: 0,
  };

  return {
    at: meta.at ?? artifact.createdAt.toISOString(),
    summary: artifact.content.slice(0, 300),
    whatHappened: [],
    whatWasCreated: [],
    whatFailed: [],
    needsApproval: [],
    bottleneck: null,
    topOpportunities: [],
    actionPlan: [],
    counts,
  };
}
