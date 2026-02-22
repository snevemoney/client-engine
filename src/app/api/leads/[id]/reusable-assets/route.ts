import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const ASSET_TYPES = [
  "template",
  "component",
  "workflow",
  "prompt_pack",
  "checklist",
  "case_study",
  "prompt_pattern",
  "sales_script",
  "sop_playbook",
  "none",
] as const;

/** GET /api/leads/[id]/reusable-assets — List reusable asset logs for this lead. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leadId } = await params;
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const logs = await db.reusableAssetLog.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(logs);
}

/** POST /api/leads/[id]/reusable-assets — Create a reusable asset log entry (human-driven). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leadId } = await params;
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { project: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const body = await req.json();
  const assetType = body.assetType as string;
  if (!assetType || !ASSET_TYPES.includes(assetType as (typeof ASSET_TYPES)[number])) {
    return NextResponse.json(
      { error: "assetType required; one of: " + ASSET_TYPES.join(", ") },
      { status: 400 }
    );
  }

  const label = body.label ?? (assetType === "none" ? "None" : null);
  const reasonNone = body.reasonNone ?? (assetType === "none" ? body.reason ?? "Not extracted" : null);
  const notes = body.notes ?? null;
  const projectId = lead.project?.id ?? null;
  const reusabilityScore = typeof body.reusabilityScore === "number" && body.reusabilityScore >= 1 && body.reusabilityScore <= 5 ? body.reusabilityScore : null;
  const whereStored = typeof body.whereStored === "string" ? body.whereStored.trim() || null : null;
  const canProductize = typeof body.canProductize === "string" && ["yes", "no", "maybe"].includes(body.canProductize) ? body.canProductize : null;

  const log = await db.reusableAssetLog.create({
    data: {
      leadId,
      projectId,
      assetType,
      label,
      reasonNone,
      notes,
      reusabilityScore,
      whereStored,
      canProductize,
    },
  });

  return NextResponse.json(log, { status: 201 });
}
