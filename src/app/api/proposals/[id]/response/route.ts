/**
 * POST /api/proposals/[id]/response — Log response status (viewed/replied/meeting_booked/negotiating).
 * For accepted/rejected use existing /accept and /reject endpoints.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProposalActivityType, ProposalResponseStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { parseDate } from "@/lib/followup/dates";

const RESPONSE_STATUSES = ["viewed", "replied", "meeting_booked", "negotiating"] as const;

const PostSchema = z.object({
  responseStatus: z.enum(RESPONSE_STATUSES),
  responseSummary: z.string().max(2000).optional().nullable(),
  meetingBookedAt: z.string().datetime().optional().nullable(),
  bookingUrlUsed: z.string().max(500).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proposals/[id]/response", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const proposal = await db.proposal.findUnique({ where: { id } });
    if (!proposal) return jsonError("Proposal not found", 404);

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) return jsonError("Invalid body: responseStatus required", 400);

    const now = new Date();
    const status = parsed.data.responseStatus as (typeof RESPONSE_STATUSES)[number];

    const data: Record<string, unknown> = {
      responseStatus: status as ProposalResponseStatus,
      responseSummary: parsed.data.responseSummary ?? proposal.responseSummary,
    };

    if (status === "viewed") {
      data.viewedAt = proposal.viewedAt ?? now;
    }
    if (status === "replied") {
      data.respondedAt = proposal.respondedAt ?? now;
    }
    if (status === "meeting_booked") {
      const meetingAt = parsed.data.meetingBookedAt
        ? parseDate(parsed.data.meetingBookedAt)
        : now;
      data.meetingBookedAt = proposal.meetingBookedAt ?? meetingAt ?? now;
      data.respondedAt = proposal.respondedAt ?? now;
      data.bookingUrlUsed = parsed.data.bookingUrlUsed ?? proposal.bookingUrlUsed;
    }

    const activityType: ProposalActivityType =
      status === "meeting_booked" ? "meeting_booked" : "response_logged";

    await db.$transaction([
      db.proposal.update({
        where: { id },
        data: data as Parameters<typeof db.proposal.update>[0]["data"],
      }),
      db.proposalActivity.create({
        data: {
          proposalId: id,
          type: activityType,
          message: `Response: ${status}`,
          metaJson: { responseStatus: status, responseSummary: parsed.data.responseSummary },
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  });
}
