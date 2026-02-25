/**
 * GET /api/reminders — List reminders with filters.
 * POST /api/reminders — Create reminder manually.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { parsePaginationParams, buildPaginationMeta, paginatedResponse } from "@/lib/pagination";
import { db } from "@/lib/db";
import { classifyReminderBucket } from "@/lib/reminders/dates";
import { sortReminders } from "@/lib/reminders/priorities";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withRouteTiming("GET /api/reminders", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status");
      const bucket = searchParams.get("bucket");
      const priority = searchParams.get("priority");
      const kind = searchParams.get("kind");
      const search = searchParams.get("search")?.trim();
      const pagination = parsePaginationParams(searchParams);

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (kind) where.kind = kind;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      let reminders = await db.opsReminder.findMany({
        where,
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
        take: 500,
      });

      if (bucket) {
        const now = new Date();
        reminders = reminders.filter((r) => classifyReminderBucket(r.dueAt, r.snoozedUntil, r.status, now) === bucket);
      }

      const sorted = sortReminders(reminders);
      const total = sorted.length;
      const pageItems = sorted.slice(pagination.skip, pagination.skip + pagination.pageSize);
      const meta = buildPaginationMeta(total, pagination);

      const mapped = pageItems.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        description: r.description,
        status: r.status,
        priority: r.priority,
        dueAt: r.dueAt?.toISOString() ?? null,
        snoozedUntil: r.snoozedUntil?.toISOString() ?? null,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        actionUrl: r.actionUrl,
        suggestedAction: r.suggestedAction,
        createdByRule: r.createdByRule,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      }));
      return NextResponse.json({
        ...paginatedResponse(mapped, meta),
        reminders: mapped,
      });
    } catch (err) {
      console.error("[reminders GET]", err);
      return jsonError("Failed to load reminders", 500);
    }
  });
}

export async function POST(req: Request) {
  return withRouteTiming("POST /api/reminders", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const body = await req.json().catch(() => ({}));
      const title = body.title ?? "New reminder";
      const kind = body.kind ?? "manual";
      const description = body.description ?? null;
      const priority = ["low", "medium", "high", "critical"].includes(body.priority) ? body.priority : "medium";
      const dueAt = body.dueAt ? new Date(body.dueAt) : null;
      const actionUrl = body.actionUrl ?? null;
      const suggestedAction = body.suggestedAction ?? null;

      const reminder = await db.opsReminder.create({
        data: {
          kind,
          title,
          description,
          status: "open",
          priority,
          dueAt,
          actionUrl,
          suggestedAction,
          sourceType: body.sourceType ?? null,
          sourceId: body.sourceId ?? null,
        },
      });

      return NextResponse.json({
        id: reminder.id,
        kind: reminder.kind,
        title: reminder.title,
        status: reminder.status,
        createdAt: reminder.createdAt.toISOString(),
      });
    } catch (err) {
      console.error("[reminders POST]", err);
      return jsonError("Failed to create reminder", 500);
    }
  });
}
