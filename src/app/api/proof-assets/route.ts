import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET: list NDA-safe proof assets (for content ideas and proposals). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 20, 50);
  const assets = await db.proofAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json(assets);
}

/** POST: create NDA-safe proof asset (no client names). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const anonymizedCasePattern =
    typeof b.anonymizedCasePattern === "string" && b.anonymizedCasePattern.trim()
      ? b.anonymizedCasePattern.trim()
      : null;
  if (!anonymizedCasePattern) {
    return NextResponse.json({ error: "anonymizedCasePattern is required" }, { status: 400 });
  }

  const lessonLearned = typeof b.lessonLearned === "string" ? b.lessonLearned.trim() || null : null;
  const outcomeSummary = typeof b.outcomeSummary === "string" ? b.outcomeSummary.trim() || null : null;
  const processImprovement =
    typeof b.processImprovement === "string" ? b.processImprovement.trim() || null : null;
  const channelContentIdeas = Array.isArray(b.channelContentIdeas)
    ? (b.channelContentIdeas as string[]).filter((s) => typeof s === "string").slice(0, 20)
    : [];
  const linkedArtifactIds = Array.isArray(b.linkedArtifactIds)
    ? (b.linkedArtifactIds as string[]).filter((s) => typeof s === "string").slice(0, 20)
    : [];

  const asset = await db.proofAsset.create({
    data: {
      anonymizedCasePattern,
      lessonLearned,
      outcomeSummary,
      processImprovement,
      channelContentIdeas,
      linkedArtifactIds,
    },
  });
  return NextResponse.json(asset);
}
