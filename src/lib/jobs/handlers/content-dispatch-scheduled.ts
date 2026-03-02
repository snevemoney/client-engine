/**
 * Job handler: dispatch scheduled content posts whose scheduledFor has passed.
 */
import { db } from "@/lib/db";
import { executePost } from "@/lib/distribution/service";
import { logOpsEventSafe } from "@/lib/ops-events/log";

export async function handleContentDispatchScheduled(payload: {
  limit?: number;
}): Promise<object> {
  const limit = Math.min(payload?.limit ?? 20, 100);

  const duePosts = await db.contentPost.findMany({
    where: { status: "scheduled", scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  let posted = 0;
  let failed = 0;

  for (const post of duePosts) {
    try {
      await executePost(post.id);
      posted++;
      logOpsEventSafe({
        category: "automation",
        eventKey: "content.post.dispatched",
        meta: { contentPostId: post.id, platform: post.platform },
      });
    } catch (err) {
      failed++;
      await db.contentPost.update({
        where: { id: post.id },
        data: {
          status: "failed",
          errorMessage: (err instanceof Error ? err.message : String(err)).slice(0, 500),
        },
      });
    }
  }

  return { found: duePosts.length, posted, failed };
}
