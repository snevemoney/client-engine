import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedAudienceHealth } from "@/lib/ops/ownedAudience";

/** GET: list recent ledger entries or health summary for Command Center. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode"); // "health" | null (list)

  if (mode === "health") {
    const health = await getOwnedAudienceHealth();
    return NextResponse.json(health);
  }

  const limit = Math.min(Number(searchParams.get("limit")) || 10, 50);
  const entries = await db.ownedAudienceLedger.findMany({
    orderBy: { at: "desc" },
    take: limit,
  });
  return NextResponse.json(entries);
}

/** POST: create a ledger snapshot (manual entry). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const at = b.at != null ? new Date(b.at as string) : new Date();
  const subscribers = Number(b.subscribers) || 0;
  const sends = Number(b.sends) || 0;
  const replies = Number(b.replies) || 0;
  const clicks = Number(b.clicks) || 0;
  const inquiriesInfluenced = Number(b.inquiriesInfluenced) || 0;
  const note = typeof b.note === "string" ? b.note : null;

  const entry = await db.ownedAudienceLedger.create({
    data: {
      at,
      subscribers,
      sends,
      replies,
      clicks,
      inquiriesInfluenced,
      note,
    },
  });
  return NextResponse.json(entry);
}
