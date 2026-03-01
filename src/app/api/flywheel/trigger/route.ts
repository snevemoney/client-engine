/**
 * POST /api/flywheel/trigger — Trigger the full flywheel pipeline.
 *
 * Accepts either:
 *   { leadId }            — run pipeline on existing lead (skip lead creation)
 *   { title, source, … }  — create new lead + run full flywheel
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError, withRouteTiming } from "@/lib/api-utils";
import { runFlywheel } from "@/lib/orchestrator/flywheel";
import { db } from "@/lib/db";

const TriggerSchema = z.union([
  // Existing lead
  z.object({ leadId: z.string().min(1) }),
  // New prospect
  z.object({
    title: z.string().min(1).max(500),
    source: z.string().max(100).optional().default("manual"),
    sourceUrl: z.string().max(2000).optional(),
    description: z.string().max(10000).optional(),
    contactName: z.string().max(200).optional(),
    contactEmail: z.string().max(200).optional(),
    company: z.string().max(200).optional(),
    budget: z.string().max(200).optional(),
    timeline: z.string().max(200).optional(),
    tags: z.array(z.string()).optional().default([]),
    builderPreset: z.string().optional(),
    builderScope: z.array(z.string()).optional(),
    contentHints: z.string().max(5000).optional(),
    autoSendProposal: z.boolean().optional(),
    autoBuild: z.boolean().optional(),
  }),
]);

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/flywheel/trigger", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const raw = await req.json().catch(() => null);
    const parsed = TriggerSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request", 400, "VALIDATION");
    }

    const body = parsed.data;

    // If leadId provided, load lead data and build flywheel input from it
    if ("leadId" in body) {
      const lead = await db.lead.findUnique({ where: { id: body.leadId } });
      if (!lead) return jsonError("Lead not found", 404);

      const result = await runFlywheel({
        leadId: lead.id,
        title: lead.title,
        source: lead.source ?? "manual",
        sourceUrl: lead.sourceUrl ?? undefined,
        description: lead.description ?? undefined,
        contactName: lead.contactName ?? undefined,
        contactEmail: lead.contactEmail ?? undefined,
        company: (lead as Record<string, unknown>).company as string | undefined,
        budget: lead.budget ?? undefined,
        timeline: lead.timeline ?? undefined,
        tags: lead.tags ?? [],
      });

      return NextResponse.json(result, { status: result.ok ? 200 : 207 });
    }

    // New prospect — create lead + full flywheel
    const result = await runFlywheel({
      title: body.title,
      source: body.source,
      sourceUrl: body.sourceUrl,
      description: body.description,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      company: body.company,
      budget: body.budget,
      timeline: body.timeline,
      tags: body.tags,
      builderPreset: body.builderPreset as never,
      builderScope: body.builderScope,
      contentHints: body.contentHints,
      autoSendProposal: body.autoSendProposal,
      autoBuild: body.autoBuild,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  }, { eventKey: "flywheel.trigger", method: "POST", sourceType: "flywheel" });
}
