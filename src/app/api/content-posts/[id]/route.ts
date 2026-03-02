import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { schedulePost, executePost } from "@/lib/distribution/service";

/** PATCH /api/content-posts/[id] — schedule or execute a content post */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/content-posts/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const post = await db.contentPost.findUnique({ where: { id } });
    if (!post) return jsonError("Content post not found", 404);

    const body = await req.json().catch(() => null);
    if (!body?.action) return jsonError("Missing action", 400);

    if (body.action === "schedule") {
      if (post.status !== "draft") {
        return jsonError("Only draft posts can be scheduled", 400);
      }
      const scheduledFor = body.scheduledFor
        ? new Date(body.scheduledFor)
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            d.setHours(10, 0, 0, 0);
            return d;
          })();

      if (isNaN(scheduledFor.getTime())) {
        return jsonError("Invalid scheduledFor date", 400);
      }

      const result = await schedulePost(id, scheduledFor);
      return NextResponse.json({ ok: true, post: result });
    }

    if (body.action === "execute") {
      if (post.status !== "draft" && post.status !== "scheduled") {
        return jsonError("Only draft or scheduled posts can be executed", 400);
      }
      const result = await executePost(id);
      return NextResponse.json({ ok: true, post: result });
    }

    return jsonError(`Unknown action: ${body.action}`, 400);
  });
}
