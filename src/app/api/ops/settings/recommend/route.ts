/**
 * POST /api/ops/settings/recommend — AI-powered settings recommendations.
 * Gathers business context (pipeline data, money scorecard, constraint, chat history)
 * and uses Claude to suggest optimal OperatorSettings values.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { createBrainMessage } from "@/lib/llm/anthropic";
import { getMoneyScorecard } from "@/lib/ops/moneyScorecard";
import { getConstraintSnapshot } from "@/lib/ops/constraint";
import { getOperatorSettings } from "@/lib/ops/settings";
import { getFailuresAndInterventions } from "@/lib/ops/failuresInterventions";
import { db } from "@/lib/db";
import { safeParseJSON } from "@/lib/llm/safe-parse-json";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST() {
  return withRouteTiming("POST /api/ops/settings/recommend", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    // Gather business context in parallel
    const [currentSettings, money, constraint, failures, recentLeads, recentSessions] =
      await Promise.all([
        getOperatorSettings(),
        getMoneyScorecard(),
        getConstraintSnapshot().catch(() => null),
        getFailuresAndInterventions().catch(() => ({ totalCount: 0, staleLeads: [], stuckProposals: [], needsApproval: [], failedPipelineRuns: [] })),
        // Recent leads for niche/offer pattern detection
        db.lead.findMany({
          where: { dealOutcome: { in: ["won", "lost"] } },
          orderBy: { updatedAt: "desc" },
          take: 30,
          select: {
            title: true,
            source: true,
            budget: true,
            score: true,
            dealOutcome: true,
            tags: true,
            description: true,
          },
        }),
        // Recent brain conversations for pattern detection
        db.copilotSession.findMany({
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: {
            title: true,
            messages: {
              orderBy: { createdAt: "asc" },
              take: 6,
              select: { role: true, contentJson: true },
            },
          },
        }),
      ]);

    // Build context for Claude
    const leadPatterns = recentLeads.length > 0
      ? recentLeads.map((l) => {
          const desc = typeof l.description === "string" ? l.description.slice(0, 100) : "";
          return `- ${l.title} | ${l.dealOutcome} | budget: ${l.budget ?? "?"} | score: ${l.score ?? "?"} | ${desc}`;
        }).join("\n")
      : "No closed deals yet.";

    const chatSnippets = recentSessions
      .filter((s) => s.messages.length > 0)
      .slice(0, 5)
      .map((s) => {
        const msgs = s.messages
          .filter((m) => m.role === "user")
          .map((m) => {
            const c = m.contentJson;
            if (typeof c === "string") return c.slice(0, 120);
            if (Array.isArray(c)) {
              const txt = c.find((b) => typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "text") as Record<string, unknown> | undefined;
              return typeof txt?.text === "string" ? (txt.text as string).slice(0, 120) : "";
            }
            return "";
          })
          .filter(Boolean);
        return msgs.length > 0 ? `Session "${s.title ?? "untitled"}": ${msgs.join(" | ")}` : null;
      })
      .filter(Boolean)
      .join("\n");

    const constraintText = constraint
      ? `Primary bottleneck: ${constraint.label} — ${constraint.reason}`
      : "No constraint detected.";

    const currentSettingsText = JSON.stringify(currentSettings, null, 2);

    const systemPrompt = `You are a business operations AI advisor. Analyze the user's business data and recommend optimal settings.

Return a JSON object with recommended settings. Only include fields where you have enough data to make a confident recommendation. Skip fields where data is insufficient.

The JSON must follow this exact schema:
{
  "nicheStatement": "string — who they help",
  "offerStatement": "string — what they offer",
  "buyerProfile": "string — ideal client description",
  "scoringProfile": {
    "idealProjects": "string — project types that convert",
    "budgetRange": "string — budget range of won deals",
    "typicalTimeline": "string — delivery timeline",
    "techStack": "string — tech they use",
    "prefers": "string — patterns in winning deals",
    "avoids": "string — patterns in lost deals"
  },
  "workdayIntervalMinutes": number,
  "workdayMaxLeadsPerRun": number,
  "workdayMaxRunsPerDay": number,
  "reasoning": "string — brief explanation of why these recommendations"
}

Rules:
- Base recommendations on ACTUAL data patterns, not generic advice
- For niche/offer/buyer: infer from won deals, lead titles, descriptions, and chat history
- For scoring profile: analyze won vs lost deal patterns
- For automation: recommend based on pipeline velocity and constraint data
- If current settings already look good, say so in reasoning
- Keep statements concise and specific, not generic marketing speak
- Return ONLY the JSON object, no markdown or extra text`;

    const userMessage = `Here is my business data. Recommend optimal settings.

## Current Settings
${currentSettingsText}

## Money Scorecard (Last 30 Days)
- Leads discovered: ${money.leadsDiscovered}
- Leads qualified: ${money.leadsQualified}
- Proposals drafted: ${money.proposalsDrafted}
- Proposals sent: ${money.proposalsSent}
- Deals won: ${money.dealsWon}
- Deals lost: ${money.dealsLost}
- Pipeline value: $${money.pipelineValueEstimate}
- Avg deal size: ${money.avgDealSizeEstimate ? `$${money.avgDealSizeEstimate}` : "unknown"}
- Time to proposal: ${money.timeToProposalMedianDays ? `${money.timeToProposalMedianDays} days` : "unknown"}
- Deals won (90d): ${money.dealsWon90d ?? 0}

## Constraint Analysis
${constraintText}

## Pipeline Health
- Failed runs: ${failures.failedPipelineRuns?.length ?? 0}
- Stale leads (no touch >7d): ${failures.staleLeads?.length ?? 0}
- Stuck proposals (ready >5d): ${failures.stuckProposals?.length ?? 0}
- Needs approval: ${failures.needsApproval?.length ?? 0}

## Recent Closed Deals
${leadPatterns}

## Recent Chat History (what the user talks about)
${chatSnippets || "No chat history yet."}`;

    try {
      const response = await createBrainMessage({
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        tools: [],
        maxTokens: 2048,
        temperature: 0.2,
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return jsonError("No recommendation generated", 500);
      }

      // Parse JSON from response (handle potential markdown wrapping)
      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      const recommendations = safeParseJSON(jsonText);
      return NextResponse.json({ recommendations });
    } catch (e) {
      console.error("[settings/recommend] Error:", e);
      return jsonError(
        e instanceof SyntaxError ? "Failed to parse AI response" : "Recommendation failed",
        500
      );
    }
  });
}
