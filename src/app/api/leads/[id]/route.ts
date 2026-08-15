import { NextRequest, NextResponse } from "next/server";
import { checkStateChangeRateLimit, jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getById, update, deleteLead } from "@/lib/services/lead-service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRouteTiming("GET /api/leads/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const lead = await getById(id);
    if (!lead) return jsonError("Lead not found", 404);

    return NextResponse.json(lead);
  });
}

// Money-path lock: only these fields are patchable. status, approvedAt, build*,
// proposalSentAt, dealOutcome, score, enrichedAt, scoredAt are set only by
// approve/reject, build, and outcome endpoints — never via PATCH.
const ALLOWED_PATCH_FIELDS = new Set([
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
  "salesStage",
  "nextContactAt",
  "lastContactAt",
  "followUpCount",
  "followUpCadenceDays",
  "permissionToFollowUp",
  "personalDetails",
  "leadSourceType",
  "leadSourceChannel",
  "introducedBy",
  "referralAskStatus",
  "referralAskAt",
  "referralCount",
  "referralNames",
  "sourceDetail",
  "lastTouchType",
  "followUpStage",
  "detailScore",
  "relationshipStatus",
  "relationshipLastCheck",
  "nextAction",
  "nextActionDueAt",
]);

const VALID_TOUCH_TYPES = new Set(["EMAIL", "CALL", "LINKEDIN_DM", "MEETING", "FOLLOW_UP", "REFERRAL_ASK", "CHECK_IN"]);

function pickAllowedLeadPatch(body: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (!ALLOWED_PATCH_FIELDS.has(key)) {
      const err = new Error(`Field '${key}' cannot be updated via PATCH /api/leads/[id]`);
      (err as Error & { code?: string }).code = "GATE";
      throw err;
    }
    const val = body[key];

    if (key === "followUpStage") {
      if (val !== null && val !== undefined && (typeof val !== "number" || !Number.isInteger(val) || val < 0)) {
        throw new Error("followUpStage must be a non-negative integer");
      }
    }

    if (key === "lastTouchType") {
      if (val !== null && val !== undefined && (typeof val !== "string" || !VALID_TOUCH_TYPES.has(val))) {
        throw new Error(`lastTouchType must be one of: ${[...VALID_TOUCH_TYPES].join(", ")}`);
      }
    }

    if (key === "detailScore") {
      if (val !== null && val !== undefined && (typeof val !== "number" || !Number.isInteger(val) || val < 0 || val > 100)) {
        throw new Error("detailScore must be an integer 0-100");
      }
    }

    if (key === "nextAction") {
      if (val !== null && val !== undefined && (typeof val !== "string" || val.length > 2000)) {
        throw new Error("nextAction must be a string up to 2000 chars");
      }
    }

    if (key === "nextActionDueAt") {
      if (val !== null && val !== undefined) {
        if (typeof val !== "string") throw new Error("nextActionDueAt must be ISO date string or null");
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) throw new Error("nextActionDueAt must be a valid date");
      }
    }

    updates[key] = val;
  }
  return updates;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRouteTiming("PATCH /api/leads/[id]", async () => {
    const rateErr = checkStateChangeRateLimit(req, "leads-patch");
    if (rateErr) return rateErr;

    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const existing = await getById(id);
    if (!existing) return jsonError("Lead not found", 404);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
      const data = pickAllowedLeadPatch(body) as Record<string, unknown> & {
        referralAskAt?: Date | string | null;
        referralAskStatus?: string | null;
        nextActionDueAt?: string | Date | null;
      };

      // When marking referral ask as "asked", set referralAskAt to now if not already provided (so Sales Leak / Referral Engine counts correctly).
      if (data.referralAskStatus === "asked" && (data.referralAskAt === undefined || data.referralAskAt === null)) {
        data.referralAskAt = new Date();
      }

      // Coerce nextActionDueAt string to Date for Prisma
      if (typeof data.nextActionDueAt === "string" && data.nextActionDueAt.trim()) {
        (data as Record<string, unknown>).nextActionDueAt = new Date(data.nextActionDueAt);
      } else if (data.nextActionDueAt === null || data.nextActionDueAt === "") {
        data.nextActionDueAt = null;
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(existing);
      }

      const lead = await update(id, data);

      return NextResponse.json(lead);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad Request";
      const status = msg.includes("cannot be updated") ? 400 : 500;
      return NextResponse.json({ error: msg }, { status });
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRouteTiming("DELETE /api/leads/[id]", async () => {
    const rateErr = checkStateChangeRateLimit(req, "leads-delete");
    if (rateErr) return rateErr;

    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const existing = await getById(id);
    if (!existing) return jsonError("Lead not found", 404);

    await deleteLead(id);

    return NextResponse.json({ ok: true });
  });
}
