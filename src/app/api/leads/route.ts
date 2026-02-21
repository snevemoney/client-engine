import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as LeadStatus | null;
  const source = url.searchParams.get("source");
  const search = url.searchParams.get("q");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (source) where.source = source;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const leads = await db.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { artifacts: true } } },
  });

  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const lead = await db.lead.create({
    data: {
      title: body.title,
      source: body.source || "manual",
      sourceUrl: body.sourceUrl,
      description: body.description,
      budget: body.budget,
      timeline: body.timeline,
      platform: body.platform,
      techStack: body.techStack || [],
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      tags: body.tags || [],
    },
  });

  void (async () => {
    try {
      const { runPipelineIfEligible } = await import("@/lib/pipeline/orchestrator");
      await runPipelineIfEligible(lead.id, "lead_created");
    } catch (err) {
      console.error("[leads] Pipeline run failed:", err);
    }
  })();

  return NextResponse.json(lead, { status: 201 });
}
