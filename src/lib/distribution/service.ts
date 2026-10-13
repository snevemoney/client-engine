/**
 * Content distribution service — turns proof records into social content posts.
 * Deterministic templates (no AI calls). Real posting APIs can be wired in later.
 */
import { db } from "@/lib/db";
import type { ContentPostPlatform, ContentPostStatus } from "@prisma/client";

type GenerateResult = {
  contentPostId: string;
  platform: ContentPostPlatform;
  status: ContentPostStatus;
};

/**
 * Generate content post drafts from a proof record.
 * Uses deterministic templates — no AI call.
 */
export async function generateContentPostDrafts(
  proofRecordId: string,
  platforms: ContentPostPlatform[] = ["linkedin"],
  generatedBy?: string
): Promise<GenerateResult[]> {
  const proof = await db.proofRecord.findUnique({
    where: { id: proofRecordId },
  });
  if (!proof) throw new Error(`ProofRecord not found: ${proofRecordId}`);

  const results: GenerateResult[] = [];

  const existing = await db.contentPost.findMany({
    where: { proofRecordId, platform: { in: platforms } },
    select: { platform: true },
  });
  const have = new Set(existing.map((p) => p.platform));

  for (const platform of platforms) {
    if (have.has(platform)) continue;

    const content = renderPostContent(proof, platform);

    const post = await db.contentPost.create({
      data: {
        proofRecordId,
        platform,
        content,
        status: "draft",
        generatedBy: generatedBy ?? "system",
      },
    });

    results.push({
      contentPostId: post.id,
      platform: post.platform,
      status: post.status,
    });
  }

  return results;
}

/**
 * Schedule a content post for publishing.
 */
export async function schedulePost(
  contentPostId: string,
  scheduledFor: Date
): Promise<{ id: string; status: ContentPostStatus }> {
  const post = await db.contentPost.update({
    where: { id: contentPostId },
    data: { status: "scheduled", scheduledFor },
  });
  return { id: post.id, status: post.status };
}

/**
 * Execute a content post (stub — marks as posted).
 * Wire real API integrations here later.
 */
export async function executePost(
  contentPostId: string
): Promise<{ id: string; status: ContentPostStatus }> {
  const post = await db.contentPost.update({
    where: { id: contentPostId },
    data: { status: "posted", postedAt: new Date() },
  });
  return { id: post.id, status: post.status };
}

// --- Template rendering ---------------------------------------

type ProofData = {
  title: string;
  company: string | null;
  beforeState: string | null;
  afterState: string | null;
  metricValue: string | null;
  metricLabel: string | null;
  proofSnippet: string | null;
};

function renderPostContent(
  proof: ProofData,
  platform: ContentPostPlatform
): string {
  const company = proof.company ?? "a local service business";
  const before = proof.beforeState ?? "Losing leads to slow follow-up";
  const after = proof.afterState ?? "Systematic follow-up capturing every opportunity";
  const metric =
    proof.metricValue && proof.metricLabel
      ? `${proof.metricValue} ${proof.metricLabel}`
      : null;

  if (platform === "linkedin") {
    return [
      `🔧 ${proof.title}`,
      "",
      `We worked with ${company} to close their follow-up gap.`,
      "",
      `Before: ${before}`,
      `After: ${after}`,
      metric ? `\nResult: ${metric}` : "",
      proof.proofSnippet ? `\n"${proof.proofSnippet}"` : "",
      "",
      "No hype. Just results.",
      "",
      "#LocalBusiness #FollowUp #WebDesign #ClientResults",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (platform === "twitter") {
    const base = `${proof.title} — ${company}`;
    const detail = metric ? ` | ${metric}` : "";
    return `${base}${detail}\n\nNo hype. Just results.`;
  }

  // email_newsletter
  return [
    `Subject: How ${company} closed their follow-up gap`,
    "",
    `Here's a quick case study from our recent work with ${company}.`,
    "",
    `The problem: ${before}`,
    `What we built: ${after}`,
    metric ? `The result: ${metric}` : "",
    proof.proofSnippet ? `\nIn their words: "${proof.proofSnippet}"` : "",
    "",
    "If you're losing leads to slow follow-up, let's talk.",
  ]
    .filter(Boolean)
    .join("\n");
}
