/**
 * Retry failed YouTube transcript fetches.
 * POST { limit?: number, videoIds?: string[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ingestVideo } from "@/lib/youtube/videoIngest";
import { TRANSCRIPT_STATUS } from "@/lib/youtube/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { limit?: number; videoIds?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 25);
  const videoIds = Array.isArray(body.videoIds)
    ? body.videoIds.filter((id): id is string => typeof id === "string" && id.length === 11)
    : [];

  const failed = await db.youTubeTranscript.findMany({
    where: videoIds.length
      ? { videoId: { in: videoIds }, transcriptStatus: TRANSCRIPT_STATUS.FAILED_TRANSCRIPT }
      : { transcriptStatus: TRANSCRIPT_STATUS.FAILED_TRANSCRIPT },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { videoId: true, sourceUrl: true },
  });

  const results: Array<{
    videoId: string;
    ok: boolean;
    status: string;
    providerUsed: string | null;
    error: string | null;
  }> = [];

  for (const row of failed) {
    const url = row.sourceUrl || `https://www.youtube.com/watch?v=${row.videoId}`;
    try {
      const result = await ingestVideo(url);
      results.push({
        videoId: row.videoId,
        ok: result.ok,
        status: result.status,
        providerUsed: result.providerUsed,
        error: result.error,
      });
    } catch (e) {
      results.push({
        videoId: row.videoId,
        ok: false,
        status: TRANSCRIPT_STATUS.FAILED_TRANSCRIPT,
        providerUsed: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    retried: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
