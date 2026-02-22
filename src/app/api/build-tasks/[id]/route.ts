import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/build-tasks/[id] — Get one build task. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await db.buildTask.findUnique({
    where: { id },
    include: {
      linkedLead: { select: { id: true, title: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(task);
}

/** PATCH /api/build-tasks/[id] — Update a build task. Allowlisted fields only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.buildTask.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const allowlist: Record<string, unknown> = {};
  const allowed = [
    "title",
    "type",
    "priority",
    "linkedLeadId",
    "linkedCriticismItem",
    "expectedOutcome",
    "status",
    "cursorPrompt",
    "prSummary",
    "humanApproved",
    "businessImpact",
  ] as const;
  for (const key of allowed) {
    if (body[key] !== undefined) allowlist[key] = body[key];
  }

  const task = await db.buildTask.update({
    where: { id },
    data: allowlist,
    include: {
      linkedLead: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(task);
}
