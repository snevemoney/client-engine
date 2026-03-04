/**
 * GET /api/delivery-projects/[id]/builder/deploy/status?jobId=xxx
 *
 * Poll deploy job status. Returns { status, liveUrl?, error? }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createQueue } from "@/lib/queue";
import { jsonError, requireDeliveryProject } from "@/lib/api-utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireDeliveryProject(id);
  if (!access.ok) return access.response;

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return jsonError("jobId query param required", 400);

  if (!process.env.REDIS_URL) {
    return jsonError("Deploy status requires Redis", 503);
  }

  const queue = createQueue("builder-deploy");
  const job = await queue.getJob(jobId);
  if (!job) return jsonError("Job not found", 404);

  const state = await job.getState();
  if (state === "completed") {
    const result = job.returnvalue as { siteId: string; liveUrl: string } | undefined;
    return NextResponse.json({
      status: "live",
      liveUrl: result?.liveUrl,
      siteId: result?.siteId,
    });
  }
  if (state === "failed") {
    const err = job.failedReason ?? "Deploy failed";
    return NextResponse.json({ status: "failed", error: err }, { status: 200 });
  }
  return NextResponse.json({ status: state });
}
