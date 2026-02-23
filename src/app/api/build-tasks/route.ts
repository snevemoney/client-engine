import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/build-tasks — List build tasks. Query: status, type, limit. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const tasks = await db.buildTask.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      linkedLead: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(tasks);
}

/** POST /api/build-tasks — Create a build task. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = body.title as string;
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  const task = await db.buildTask.create({
    data: {
      title: title.trim(),
      type: body.type ?? "feature",
      priority: body.priority ?? "medium",
      linkedLeadId: body.linkedLeadId ?? null,
      linkedCriticismItem: body.linkedCriticismItem ?? null,
      expectedOutcome: body.expectedOutcome ?? null,
      status: body.status ?? "todo",
      cursorPrompt: body.cursorPrompt ?? null,
      prSummary: body.prSummary ?? null,
      humanApproved: body.humanApproved ?? false,
      businessImpact: body.businessImpact ?? null,
    },
    include: {
      linkedLead: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
