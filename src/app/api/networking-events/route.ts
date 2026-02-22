import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getNetworkingEventsWithScores } from "@/lib/ops/networkingEvents";

/** GET: list recent networking events with quality scores. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 10, 50);
  const events = await getNetworkingEventsWithScores(limit);
  return NextResponse.json(events);
}

/** POST: create a networking event (manual entry). */
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
  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim() : null;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const eventDate = b.eventDate != null ? new Date(b.eventDate as string) : new Date();
  const audienceType = typeof b.audienceType === "string" ? b.audienceType : null;
  const relevanceScore =
    b.relevanceScore != null ? Math.min(10, Math.max(0, Number(b.relevanceScore))) : null;
  const contactsMade = Math.max(0, Number(b.contactsMade) || 0);
  const followUpsSent = Math.max(0, Number(b.followUpsSent) || 0);
  const opportunitiesCreated = Math.max(0, Number(b.opportunitiesCreated) || 0);
  const revenue = b.revenue != null ? Number(b.revenue) : null;
  const notes = typeof b.notes === "string" ? b.notes : null;

  const event = await db.networkingEvent.create({
    data: {
      name,
      eventDate,
      audienceType,
      relevanceScore,
      contactsMade,
      followUpsSent,
      opportunitiesCreated,
      revenue: revenue != null && !isNaN(revenue) ? revenue : null,
      notes,
    },
  });
  const [withScore] = await getNetworkingEventsWithScores(1);
  return NextResponse.json(withScore ?? event);
}
