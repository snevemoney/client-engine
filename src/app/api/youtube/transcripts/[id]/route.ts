import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const transcript = await db.youTubeTranscript.findUnique({
    where: { id },
    select: { id: true, videoId: true },
  });
  if (!transcript) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  // Find proposal IDs to cascade-delete linked assets
  const proposals = await db.learningProposal.findMany({
    where: { transcriptId: id },
    select: { id: true },
  });

  // Delete linked ReusableAssetLog entries (clean delete)
  if (proposals.length > 0) {
    const whereStoredValues = proposals.map((p) => `LearningProposal:${p.id}`);
    await db.reusableAssetLog.deleteMany({
      where: { whereStored: { in: whereStoredValues } },
    });
  }

  // Delete associated learning proposals
  await db.learningProposal.deleteMany({
    where: { transcriptId: id },
  });

  // Delete the transcript
  await db.youTubeTranscript.delete({ where: { id } });

  return NextResponse.json({ ok: true, videoId: transcript.videoId });
}
