/**
 * PATCH /api/risk/[id] — Snooze, resolve, or dismiss.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { snoozeRisk, resolveRisk, dismissRisk } from "@/lib/risk/service";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = ["snooze", "resolve", "dismiss"];

function parseSnoozeUntil(body: unknown): Date | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const preset = o.preset as string | undefined;
  const custom = o.until as string | undefined;

  if (custom && typeof custom === "string") {
    const d = new Date(custom.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (preset === "2d") {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d;
  }
  if (preset === "7d") {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/risk/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    if (!id) return jsonError("Missing risk id", 400);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (!body || typeof body !== "object") {
      return jsonError("Body must be an object", 400);
    }

    const action = (body as Record<string, unknown>).action;
    if (typeof action !== "string" || !VALID_ACTIONS.includes(action)) {
      return jsonError(`action must be one of: ${VALID_ACTIONS.join(", ")}`, 400);
    }

    try {
      if (action === "snooze") {
        const until = parseSnoozeUntil(body);
        if (!until || until <= new Date()) {
          return jsonError("snooze requires preset (2d|7d) or until (ISO date in future)", 400);
        }
        await snoozeRisk(id, until);
        return NextResponse.json({ ok: true, action: "snooze", snoozedUntil: until.toISOString() });
      }
      if (action === "resolve") {
        await resolveRisk(id);
        return NextResponse.json({ ok: true, action: "resolve" });
      }
      if (action === "dismiss") {
        await dismissRisk(id);
        return NextResponse.json({ ok: true, action: "dismiss" });
      }
      return jsonError("Invalid action", 400);
    } catch (err) {
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
