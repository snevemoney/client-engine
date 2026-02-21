/**
 * Follow-up sequence for leads with proposal sent. 5-touch drafts; no auto-send.
 * Stored as FOLLOWUP_SEQUENCE_DRAFT artifact. Touch logging via FOLLOWUP_TOUCHPOINT_LOG.
 */

import { db } from "@/lib/db";
import { chat } from "@/lib/llm";
import { getLeadRoiEstimate } from "./roi";
import type { FollowUpTouch, FollowUpSequence } from "./types";
import { FOLLOWUP_SEQUENCE_DRAFT_ARTIFACT_TYPE, FOLLOWUP_TOUCHPOINT_LOG_ARTIFACT_TYPE } from "./types";

const POSITIONING_TITLE = "POSITIONING_BRIEF";

export async function generateFollowUpSequence(leadId: string): Promise<{ artifactId: string; touches: FollowUpTouch[] }> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      artifacts: {
        where: {
          OR: [
            { type: "positioning", title: POSITIONING_TITLE },
            { type: "proposal" },
            { type: "ROI_ESTIMATE" },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!lead) throw new Error("Lead not found");
  const proposal = lead.artifacts.find((a) => a.type === "proposal");
  if (!proposal) throw new Error("Lead has no proposal; generate proposal first.");

  const positioning = lead.artifacts.find((a) => a.type === "positioning" && a.title === POSITIONING_TITLE);
  const roi = await getLeadRoiEstimate(leadId);

  const contextParts: string[] = [];
  contextParts.push(`Lead: ${lead.title}`);
  if (lead.description) contextParts.push(`Description: ${lead.description.slice(0, 800)}`);
  if (positioning?.content) contextParts.push(`Positioning: ${positioning.content.slice(0, 600)}`);
  contextParts.push(`Proposal (excerpt): ${proposal.content.slice(0, 1200)}`);
  if (roi?.meta) {
    contextParts.push(`ROI why now: ${roi.meta.whyNow}`);
    contextParts.push(`Pilot: ${roi.meta.pilotRecommendation}`);
  }
  const context = contextParts.join("\n\n---\n\n");

  const systemPrompt = `You are an expert at writing follow-up sequences for a freelance developer. No auto-send: these are drafts only.
Output valid JSON only, no markdown. An array of exactly 5 objects. Each object:
{ "subject": "string", "body": "string", "tone": "calm" | "professional", "variant": "short" | "standard", "suggestedSendAfterDays": number }

Touch 1: After proposal sent — soft recap, one clear next step.
Touch 2: Value reinforcement — ROI / risk / cost of inaction (use their problem and pilot if available).
Touch 3: Objection-lowering — pilot offer, low-risk start, small first step.
Touch 4: Proof-oriented — results, case style, credibility.
Touch 5: Clean close — "should I close this out?" or clear call to action.

Rules:
- No fake urgency. No manipulative language. No "just checking in" fluff.
- Tie each message to their problem, expected outcome, and a small next step.
- Tone: calm, professional, no hype, no pressure.
- subject: email subject line. body: full message body (2-4 short paragraphs).
- suggestedSendAfterDays: days after proposal sent (1, 3, 7, 14, 21 for touches 1-5).`;

  const userPrompt = `Generate the 5-touch follow-up sequence as JSON array.\n\n${context}`;

  const { content } = await chat(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    { temperature: 0.4, max_tokens: 2048 }
  );

  let touches: FollowUpTouch[];
  try {
    const parsed = JSON.parse(content.trim().replace(/^```json?\s*|\s*```$/g, "")) as unknown[];
    touches = (Array.isArray(parsed) ? parsed : []).slice(0, 5).map((t) => {
      const x = t as Record<string, unknown>;
      return {
        subject: typeof x.subject === "string" ? x.subject : "Follow-up",
        body: typeof x.body === "string" ? x.body : "",
        tone: x.tone === "professional" ? "professional" : "calm",
        variant: x.variant === "short" ? "short" : "standard",
        suggestedSendAfterDays: typeof x.suggestedSendAfterDays === "number" ? x.suggestedSendAfterDays : undefined,
      };
    });
  } catch {
    touches = [
      { subject: "Follow-up: next step", body: "Draft failed to parse. Please edit manually.", tone: "calm", variant: "standard" },
    ];
  }

  const sequence: FollowUpSequence = {
    leadId,
    touches,
    generatedAt: new Date().toISOString(),
  };

  const contentMarkdown = touches
    .map(
      (t, i) =>
        `## Touch ${i + 1}${t.suggestedSendAfterDays != null ? ` (day ${t.suggestedSendAfterDays})` : ""}\n\n**Subject:** ${t.subject}\n\n${t.body}`
    )
    .join("\n\n---\n\n");

  const existing = await db.artifact.findFirst({
    where: { leadId, type: FOLLOWUP_SEQUENCE_DRAFT_ARTIFACT_TYPE },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    await db.artifact.update({
      where: { id: existing.id },
      data: { content: contentMarkdown, meta: sequence },
    });
    return { artifactId: existing.id, touches };
  }

  const artifact = await db.artifact.create({
    data: {
      leadId,
      type: FOLLOWUP_SEQUENCE_DRAFT_ARTIFACT_TYPE,
      title: "FOLLOWUP_SEQUENCE",
      content: contentMarkdown,
      meta: sequence,
    },
  });
  return { artifactId: artifact.id, touches };
}

export async function getFollowUpSequence(leadId: string): Promise<{ id: string; content: string; touches: FollowUpTouch[] } | null> {
  const a = await db.artifact.findFirst({
    where: { leadId, type: FOLLOWUP_SEQUENCE_DRAFT_ARTIFACT_TYPE },
    orderBy: { createdAt: "desc" },
  });
  if (!a || !a.meta || typeof a.meta !== "object") return null;
  const seq = a.meta as { touches?: FollowUpTouch[] };
  return { id: a.id, content: a.content, touches: Array.isArray(seq.touches) ? seq.touches : [] };
}

/** Log a touch as sent (manual). Creates FOLLOWUP_TOUCHPOINT_LOG artifact. */
export async function logTouchSent(leadId: string, touchIndex: number, note?: string): Promise<void> {
  await db.artifact.create({
    data: {
      leadId,
      type: FOLLOWUP_TOUCHPOINT_LOG_ARTIFACT_TYPE,
      title: `Touch ${touchIndex + 1} sent`,
      content: note ?? `Touch ${touchIndex + 1} marked sent at ${new Date().toISOString()}`,
      meta: { touchIndex, sentAt: new Date().toISOString() },
    },
  });
}
