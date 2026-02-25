/**
 * POST /api/ops-events/page-view — Log page view (deduplicated)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logOpsEventSafe, safeFingerprint } from "@/lib/ops-events/log";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/ops-events/page-view", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    let body: { route?: string; pathname?: string } = {};
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    const route = body.route ?? body.pathname ?? "/";
    const fingerprint = safeFingerprint([
      "page_view",
      route,
      Math.floor(Date.now() / 60000),
      session.user.email ?? session.user.id,
    ]);

    logOpsEventSafe({
      category: "page_view",
      eventKey: "page.view",
      eventLabel: `View: ${route}`,
      route,
      meta: { pathname: route },
      fingerprint,
      actorType: "user",
      actorId: session.user.id ?? undefined,
      actorLabel: session.user.email ?? undefined,
    });

    return NextResponse.json({ ok: true });
  });
}
