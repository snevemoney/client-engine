import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withRouteTiming } from "@/lib/api-utils";
import {
  extractForKnowledge,
  extractForLearning,
  extractForStrategy,
  extractForLead,
} from "@/lib/web-research/context-extract";

const SaveToSchema = z.object({
  destination: z.enum(["lead", "knowledge", "learning", "strategy"]),
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  mode: z.enum(["deep", "competitive", "technical"]),
});

async function getOrCreateSystemLead(title: string): Promise<string> {
  const existing = await db.lead.findFirst({
    where: { source: "system", title },
    select: { id: true },
  });
  if (existing) return existing.id;
  const lead = await db.lead.create({
    data: { title, source: "system" },
  });
  return lead.id;
}

/**
 * POST /api/research/web/save-to
 * Route research brief data to different parts of the app.
 * Uses LLM extraction to generate destination-specific metadata.
 */
export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/research/web/save-to", async () => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = SaveToSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }

    const { destination, title, content, mode } = parsed.data;

    switch (destination) {
      case "lead": {
        let leadData: { title: string; description: string; techStack: string[]; tags: string[]; budget?: string; timeline?: string; platform?: string; sourceDetail?: string };
        try {
          leadData = await extractForLead(title, content);
        } catch (err) {
          console.warn("[save-to] Lead extraction failed, using fallback:", err);
          leadData = { title, description: `${mode} research brief`, techStack: [], tags: ["web-research"] };
        }

        const lead = await db.lead.create({
          data: {
            title: leadData.title,
            source: "web-research",
            description: leadData.description,
            techStack: leadData.techStack,
            tags: leadData.tags,
            budget: leadData.budget,
            timeline: leadData.timeline,
            platform: leadData.platform,
            sourceDetail: leadData.sourceDetail,
          },
        });
        await db.artifact.create({
          data: {
            leadId: lead.id,
            type: "research",
            title: "WEB_RESEARCH_BRIEF",
            content,
            meta: { mode, savedFrom: "brief-action" },
          },
        });
        return NextResponse.json({ ok: true, id: lead.id, destination, message: "Saved as lead" });
      }

      case "knowledge": {
        let extracted: { insightText: string; kind: string; categories: string[]; tags: string[]; confidence: number };
        try {
          extracted = await extractForKnowledge(title, content);
        } catch (err) {
          console.warn("[save-to] Knowledge extraction failed, using fallback:", err);
          extracted = {
            insightText: content.slice(0, 500),
            kind: "tactical",
            categories: ["ops"],
            tags: ["web-research", mode],
            confidence: 0.5,
          };
        }

        const leadId = await getOrCreateSystemLead("Knowledge Engine Runs");
        await db.artifact.create({
          data: {
            leadId,
            type: "KNOWLEDGE_INSIGHT",
            title: extracted.kind,
            content: extracted.insightText,
            meta: {
              categories: extracted.categories,
              [extracted.kind]: true,
              capturedAt: new Date().toISOString(),
              tags: extracted.tags,
              confidence: extracted.confidence,
            },
          },
        });
        return NextResponse.json({ ok: true, destination, message: "Added to Knowledge" });
      }

      case "learning": {
        let proposal: { title: string; insightType: string; problemObserved: string; principle: string; proposedChange: string; expectedImpact: string; effort: string; risk: string; metricToTrack?: string; applyTarget?: string };
        try {
          proposal = await extractForLearning(title, content);
        } catch (err) {
          console.warn("[save-to] Learning extraction failed, using fallback:", err);
          proposal = {
            title,
            insightType: "ops",
            problemObserved: "Web research finding",
            principle: title,
            proposedChange: content.slice(0, 500),
            expectedImpact: "Informed decision-making",
            effort: "low",
            risk: "low",
          };
        }

        const proposalContent = [
          `# ${proposal.title}`,
          "",
          `**Type:** ${proposal.insightType} | **Effort:** ${proposal.effort} | **Risk:** ${proposal.risk}`,
          "",
          `## Problem Observed`,
          proposal.problemObserved,
          "",
          `## Principle`,
          proposal.principle,
          "",
          `## Proposed Change`,
          proposal.proposedChange,
          "",
          `## Expected Impact`,
          proposal.expectedImpact,
          ...(proposal.metricToTrack ? ["", `**Metric to track:** ${proposal.metricToTrack}`] : []),
        ].join("\n");

        const leadId = await getOrCreateSystemLead("Learning Engine Runs");
        await db.artifact.create({
          data: {
            leadId,
            type: "engine_improvement_proposal",
            title: proposal.title,
            content: proposalContent,
            meta: { proposal },
          },
        });
        return NextResponse.json({ ok: true, destination, message: "Added to Learning" });
      }

      case "strategy": {
        const week = await db.strategyWeek.findFirst({
          orderBy: { weekStart: "desc" },
          select: { id: true, notes: true },
        });
        if (!week) {
          return NextResponse.json(
            { error: "No strategy week found. Create one first in /dashboard/strategy." },
            { status: 404 },
          );
        }

        let fields: Record<string, string | undefined>;
        try {
          fields = await extractForStrategy(title, content);
        } catch (err) {
          console.warn("[save-to] Strategy extraction failed, using fallback:", err);
          const separator = week.notes ? "\n\n---\n\n" : "";
          fields = { notes: (week.notes ?? "") + separator + `## Web Research: ${title}\n${content.slice(0, 2000)}` };
        }

        // Build update data with only non-empty fields
        const updateData: Record<string, string> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value && value.trim()) {
            if (key === "notes") {
              // Append to existing notes rather than overwrite
              const separator = week.notes ? "\n\n---\n\n" : "";
              updateData.notes = (week.notes ?? "") + separator + value;
            } else {
              updateData[key] = value;
            }
          }
        }

        if (Object.keys(updateData).length > 0) {
          await db.strategyWeek.update({
            where: { id: week.id },
            data: updateData,
          });
        }

        return NextResponse.json({ ok: true, destination, message: "Added to Strategy" });
      }
    }
  });
}
