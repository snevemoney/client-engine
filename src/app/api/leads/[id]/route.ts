import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: { artifacts: { orderBy: { createdAt: "desc" } }, project: true },
  });

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

const PATCH_ALLOWED_KEYS = [
  "title",
  "source",
  "sourceUrl",
  "description",
  "budget",
  "timeline",
  "platform",
  "techStack",
  "contactName",
  "contactEmail",
  "tags",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const forbidden = Object.keys(body).filter((k) => !PATCH_ALLOWED_KEYS.includes(k as (typeof PATCH_ALLOWED_KEYS)[number]));
  if (forbidden.length > 0) {
    const msg =
      forbidden.length === 1
        ? `Field '${forbidden[0]}' cannot be updated via PATCH /leads`
        : `Fields '${forbidden.join("', '")}' cannot be updated via PATCH /leads`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const k of PATCH_ALLOWED_KEYS) {
    if (k in body) data[k] = body[k];
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No allowed fields to update" }, { status: 400 });
  }

  const lead = await db.lead.update({
    where: { id },
    data,
  });

  return NextResponse.json(lead);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.lead.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
