/**
 * POST /api/leads/[id]/driver/ai-fill
 * Use AI to infer Sales Driver fields from lead data and artifacts.
 * Returns suggested values; does not persist. User reviews and saves.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { chat } from "@/lib/llm";

const DRIVER_TYPES = ["survival", "status", "freedom", "cause", "competition", "enemy", "unknown"] as const;
const SALES_STAGES = ["PROSPECTING", "APPROACH_CONTACT", "PRESENTATION", "FOLLOW_UP", "REFERRAL", "RELATIONSHIP_MAINTENANCE"] as const;
const SOURCE_CHANNELS = ["LINKEDIN", "YOUTUBE", "TIKTOK", "INSTAGRAM", "X", "THREADS", "NETWORKING_EVENT", "REFERRAL_INTRO", "REFERRAL", "NEWSLETTER", "EMAIL_OUTREACH", "OTHER"] as const;
const REFERRAL_ASK_STATUSES = ["none", "primed", "asked", "received"] as const;
const RELATIONSHIP_STATUSES = ["active", "dormant", "nurture"] as const;

function parseJsonFromContent(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/m);
  const raw = fence ? fence[1]?.trim() ?? trimmed : trimmed;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leadId } = await params;

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      artifacts: {
        where: {
          OR: [
            { type: "notes", title: "AI Enrichment Report" },
            { type: "positioning", title: "POSITIONING_BRIEF" },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const enrichArtifact = lead.artifacts.find((a) => a.type === "notes" && a.title === "AI Enrichment Report");
  const positioningArtifact = lead.artifacts.find((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF");

  const leadContext = {
    title: lead.title,
    description: (lead.description ?? "").slice(0, 1500),
    budget: lead.budget,
    timeline: lead.timeline,
    platform: lead.platform,
    source: lead.source,
  };

  const enrichContent = enrichArtifact?.content?.slice(0, 2000) ?? "";
  const positioningContent = positioningArtifact?.content?.slice(0, 1500) ?? "";
  const positioningMeta = (positioningArtifact?.meta ?? {}) as Record<string, unknown>;

  const prompt = `You are a sales strategist. Infer the Sales Driver fields for this lead from the available context.

Driver types (pick one): survival, status, freedom, cause, competition, enemy, unknown
- survival: stopping lead leaks, immediate cash impact
- status: credibility, client experience, polish
- freedom: saving time, removing manual work
- cause: mission/business impact
- competition: gaining edge over competitors
- enemy: risk/problem they want to eliminate
- unknown: when you can't infer

Lead:
${JSON.stringify(leadContext, null, 2)}

Enrichment (if any):
${enrichContent || "(none)"}

Positioning brief (if any):
${positioningContent || "(none)"}

Positioning meta (if any):
${Object.keys(positioningMeta).length ? JSON.stringify(positioningMeta, null, 2) : "(none)"}

Return ONLY a JSON object with these keys. Use null or omit if you can't infer.

Driver & action:
- driverType: one of survival, status, freedom, cause, competition, enemy, unknown
- driverReason: 1-2 sentences on why they care
- desiredResult: what they want to happen
- proofAngle: how to frame trust/proof
- nextAction: one concrete next step

Qualification (each 0-2: 0=low, 1=medium, 2=high):
- scorePain, scoreUrgency, scoreBudget, scoreResponsiveness, scoreDecisionMaker, scoreFit

Sales stage: one of PROSPECTING, APPROACH_CONTACT, PRESENTATION, FOLLOW_UP, REFERRAL, RELATIONSHIP_MAINTENANCE
Infer from: no proposal yet → PROSPECTING; proposal sent → FOLLOW_UP; has referrals → REFERRAL; etc.

Sales process:
- salesStage: (above)
- leadSourceChannel: one of LINKEDIN, YOUTUBE, TIKTOK, INSTAGRAM, X, THREADS, NETWORKING_EVENT, REFERRAL_INTRO, REFERRAL, NEWSLETTER, EMAIL_OUTREACH, OTHER (infer from lead.source)
- sourceDetail: e.g. "Upwork job", "Reddit r/coaching"
- introducedBy: referral source if applicable
- referralAskStatus: none, primed, asked, or received
- relationshipStatus: active, dormant, or nurture

{
  "driverType": "...",
  "driverReason": "...",
  "desiredResult": "...",
  "proofAngle": "...",
  "nextAction": "...",
  "scorePain": 0|1|2,
  "scoreUrgency": 0|1|2,
  "scoreBudget": 0|1|2,
  "scoreResponsiveness": 0|1|2,
  "scoreDecisionMaker": 0|1|2,
  "scoreFit": 0|1|2,
  "salesStage": "...",
  "leadSourceChannel": "...",
  "sourceDetail": "...",
  "introducedBy": "...",
  "referralAskStatus": "...",
  "relationshipStatus": "..."
}

No markdown fences, just JSON.`;

  try {
    const { content } = await chat(
      [
        { role: "system", content: "You are a sales strategist. Return only valid JSON. No markdown." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.3, max_tokens: 768 }
    );

    const raw = parseJsonFromContent(content ?? "");
    if (!raw) {
      return NextResponse.json({ error: "AI response was not valid JSON" }, { status: 500 });
    }

    const clampScore = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      if (!Number.isInteger(n) || n < 0 || n > 2) return null;
      return n;
    };

    const driverType = typeof raw.driverType === "string" && DRIVER_TYPES.includes(raw.driverType as (typeof DRIVER_TYPES)[number])
      ? raw.driverType
      : null;
    const driverReason = typeof raw.driverReason === "string" ? raw.driverReason.trim().slice(0, 2000) : null;
    const desiredResult = typeof raw.desiredResult === "string" ? raw.desiredResult.trim().slice(0, 2000) : null;
    const proofAngle = typeof raw.proofAngle === "string" ? raw.proofAngle.trim().slice(0, 500) : null;
    const nextAction = typeof raw.nextAction === "string" ? raw.nextAction.trim().slice(0, 1000) : null;

    const salesStage = typeof raw.salesStage === "string" && SALES_STAGES.includes(raw.salesStage as (typeof SALES_STAGES)[number])
      ? raw.salesStage
      : null;
    const leadSourceChannel = typeof raw.leadSourceChannel === "string" && SOURCE_CHANNELS.includes(raw.leadSourceChannel as (typeof SOURCE_CHANNELS)[number])
      ? raw.leadSourceChannel
      : null;
    const sourceDetail = typeof raw.sourceDetail === "string" ? raw.sourceDetail.trim().slice(0, 500) : null;
    const introducedBy = typeof raw.introducedBy === "string" ? raw.introducedBy.trim().slice(0, 500) : null;
    const referralAskStatus = typeof raw.referralAskStatus === "string" && REFERRAL_ASK_STATUSES.includes(raw.referralAskStatus as (typeof REFERRAL_ASK_STATUSES)[number])
      ? raw.referralAskStatus
      : null;
    const relationshipStatus = typeof raw.relationshipStatus === "string" && RELATIONSHIP_STATUSES.includes(raw.relationshipStatus as (typeof RELATIONSHIP_STATUSES)[number])
      ? raw.relationshipStatus
      : null;

    return NextResponse.json({
      driverType,
      driverReason,
      desiredResult,
      proofAngle,
      nextAction,
      scorePain: clampScore(raw.scorePain),
      scoreUrgency: clampScore(raw.scoreUrgency),
      scoreBudget: clampScore(raw.scoreBudget),
      scoreResponsiveness: clampScore(raw.scoreResponsiveness),
      scoreDecisionMaker: clampScore(raw.scoreDecisionMaker),
      scoreFit: clampScore(raw.scoreFit),
      salesStage,
      leadSourceChannel,
      sourceDetail,
      introducedBy,
      referralAskStatus,
      relationshipStatus,
    });
  } catch (err) {
    console.error("[driver/ai-fill]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI fill failed" },
      { status: 500 }
    );
  }
}
