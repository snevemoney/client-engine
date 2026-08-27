import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { getNetworkingEventsWithScores } from "@/lib/ops/networkingEvents";
import { dollarsToCents } from "@/lib/money/cents";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  eventDate: z.string().min(1).max(40).optional(),
  audienceType: z.string().max(200).optional(),
  relevanceScore: z.number().min(0).max(10).optional(),
  contactsMade: z.number().int().min(0).optional(),
  followUpsSent: z.number().int().min(0).optional(),
  opportunitiesCreated: z.number().int().min(0).optional(),
  revenue: z.number().min(0).optional(),
  notes: z.string().max(4000).optional(),
});

/** GET: list recent networking events with quality scores. */
export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/networking-events", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 10, 50);
    const events = await getNetworkingEventsWithScores(limit);
    return NextResponse.json(events);
  });
}

/** POST: create a networking event (manual entry). Revenue is dollars in the body, cents in the DB. */
export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/networking-events", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      if (parsed.error.issues.some((i) => i.path[0] === "name")) {
        return jsonError("name is required", 400);
      }
      return jsonError("Invalid input", 400);
    }

    const b = parsed.data;
    const eventDate = b.eventDate != null ? new Date(b.eventDate) : new Date();
    if (Number.isNaN(eventDate.getTime())) return jsonError("eventDate must be a valid date", 400);

    const event = await db.networkingEvent.create({
      data: {
        name: b.name.trim(),
        eventDate,
        audienceType: b.audienceType ?? null,
        relevanceScore: b.relevanceScore != null ? Math.round(b.relevanceScore) : null,
        contactsMade: b.contactsMade ?? 0,
        followUpsSent: b.followUpsSent ?? 0,
        opportunitiesCreated: b.opportunitiesCreated ?? 0,
        revenue: b.revenue != null ? dollarsToCents(b.revenue) : null,
        notes: b.notes ?? null,
      },
    });
    const [withScore] = await getNetworkingEventsWithScores(1);
    return NextResponse.json(withScore ?? event);
  });
}
