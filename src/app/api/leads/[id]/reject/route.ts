import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Set lead to REJECTED. Optionally store a note artifact with the reason (body: { note?: string }).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  let note: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    note = body.note ?? body.reason;
  } catch {
    // no body
  }

  const updated = await db.lead.update({
    where: { id },
    data: { status: "REJECTED" },
  });

  if (note?.trim()) {
    await db.artifact.create({
      data: {
        leadId: id,
        type: "notes",
        title: "Rejection note",
        content: note.trim(),
      },
    });
  }

  const withArtifacts = await db.lead.findUnique({
    where: { id },
    include: { artifacts: { orderBy: { createdAt: "desc" } } },
  });

  return NextResponse.json(withArtifacts ?? updated);