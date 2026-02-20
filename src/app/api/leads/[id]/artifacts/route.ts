import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const artifacts = await db.artifact.findMany({
    where: { leadId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(artifacts);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const artifact = await db.artifact.create({
    data: {
      leadId: id,
      type: body.type || "notes",
      title: body.title || "Untitled",
      content: body.content || "",
    },
  });

  return NextResponse.json(artifact, { status: 201 });
}
