import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  parseProposalSections,
  buildProposalContentFromSections,
  getSnippetCharCount,
  UPWORK_SNIPPET_MAX,
  type ProposalSections,
} from "@/lib/proposals/sections";

const ProposalSectionsSchema = z.object({
  opening: z.string().optional(),
  upworkSnippet: z.string().optional(),
  questions: z.string().optional(),
});

const ArtifactPatchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  sections: ProposalSectionsSchema.optional(),
  readyToSend: z.boolean().optional(),
  sentOnUpwork: z.boolean().optional(),
});

/**
 * Deep-merge source into target. Arrays and primitives in source override.
 * Only merges plain objects recursively; other values replace.
 */
function deepMergeMeta(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    const s = source[key];
    const t = out[key];
    if (s != null && typeof s === "object" && !Array.isArray(s) && typeof t === "object" && t != null && !Array.isArray(t)) {
      out[key] = deepMergeMeta(t as Record<string, unknown>, s as Record<string, unknown>);
    } else if (s !== undefined) {
      out[key] = s;
    }
  }
  return out;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const artifact = await db.artifact.findUnique({
    where: { id },
    include: { lead: { select: { id: true, title: true, status: true, proposalSentAt: true } } },
  });

  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (artifact.type !== "proposal") {
    return NextResponse.json({ error: "Not a proposal artifact" }, { status: 400 });
  }

  const meta = (artifact.meta as Record<string, unknown>) ?? {};
  const proposalUi = (meta.proposalUi ?? meta.proposal ?? {}) as Record<string, unknown>;
  const sections = parseProposalSections(artifact.content ?? "");

  return NextResponse.json({
    ...artifact,
    proposalConsole: {
      sections,
      readyToSend: Boolean(proposalUi.readyToSend ?? meta.readyToSend),
      sentOnUpwork: Boolean(proposalUi.sentOnUpwork ?? meta.sentOnUpwork),
    },
  });
}

/** PATCH: optional title, content, meta (meta deep-merged). Only proposal artifacts. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const artifact = await db.artifact.findUnique({ where: { id } });
  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (artifact.type !== "proposal") {
    return NextResponse.json({ error: "Not a proposal artifact" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ArtifactPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const patch = parsed.data;
  const currentMeta = (artifact.meta as Record<string, unknown>) ?? {};
  let nextMeta = { ...currentMeta };
  let nextContent = artifact.content ?? "";

  if (patch.meta != null && typeof patch.meta === "object") {
    nextMeta = deepMergeMeta(currentMeta, patch.meta as Record<string, unknown>) as Record<string, unknown>;
  }

  const existingProposalUi = (nextMeta.proposalUi ?? nextMeta.proposal ?? {}) as Record<string, unknown>;
  const proposalUiUpdates: Record<string, unknown> = { ...existingProposalUi };
  if (typeof patch.readyToSend === "boolean") proposalUiUpdates.readyToSend = patch.readyToSend;
  if (typeof patch.sentOnUpwork === "boolean") {
    proposalUiUpdates.sentOnUpwork = patch.sentOnUpwork;
    if (patch.sentOnUpwork) {
      proposalUiUpdates.sentOnUpworkAt = new Date().toISOString();
      nextMeta.sentOnUpworkAt = new Date().toISOString();
    }
  }

  if (patch.sections) {
    const existingSections = parseProposalSections(nextContent);
    const merged: ProposalSections = {
      opening: patch.sections.opening ?? existingSections.opening ?? "",
      upworkSnippet: patch.sections.upworkSnippet ?? existingSections.upworkSnippet ?? "",
      questions: patch.sections.questions ?? existingSections.questions ?? "",
    };
    const snippetLen = getSnippetCharCount(merged.upworkSnippet);
    if (snippetLen > UPWORK_SNIPPET_MAX) {
      return NextResponse.json(
        { error: "Upwork snippet must be 600 characters or fewer." },
        { status: 400 }
      );
    }
    nextContent = buildProposalContentFromSections(merged);
    proposalUiUpdates.upworkSnippetChars = snippetLen;
    proposalUiUpdates.updatedAt = new Date().toISOString();
    nextMeta.updatedAt = new Date().toISOString();
    nextMeta.snippetCharCount = snippetLen;
  }

  nextMeta.proposalUi = proposalUiUpdates;
  nextMeta.proposal = proposalUiUpdates;
  nextMeta.provenance = {
    ...(typeof nextMeta.provenance === "object" && nextMeta.provenance ? nextMeta.provenance : {}),
    lastUpdatedBy: "proposal_console",
    lastUpdatedAt: new Date().toISOString(),
  };

  if (typeof patch.content === "string") nextContent = patch.content;

  const updates: { title?: string; content?: string; meta?: object } = {};
  if (patch.title !== undefined && patch.title.trim()) updates.title = patch.title.trim();
  if (patch.sections != null || typeof patch.content === "string") updates.content = nextContent;
  const metaChanged =
    patch.sections != null ||
    typeof patch.readyToSend === "boolean" ||
    typeof patch.sentOnUpwork === "boolean" ||
    (patch.meta != null && typeof patch.meta === "object");
  if (metaChanged) updates.meta = nextMeta as object;

  if (Object.keys(updates).length === 0) {
    const withLead = await db.artifact.findUnique({
      where: { id },
      include: { lead: { select: { id: true, title: true, status: true, proposalSentAt: true } } },
    });
    return NextResponse.json(withLead ?? artifact);
  }

  const updated = await db.artifact.update({
    where: { id },
    data: updates,
    include: { lead: { select: { id: true, title: true, status: true, proposalSentAt: true } } },
  });
  return NextResponse.json(updated);
}
