/**
 * Phase 9.2: Client Interaction Ledger — unified service.
 *
 * logInteraction: append-only write (accepts tx for atomic dual-write)
 * getClientTimeline: cross-entity timeline query
 * getInteractionsWithoutNextAction: NBA enforcement data
 * getInteractionGaps: Risk enforcement data
 */

import { db } from "@/lib/db";
import type { Prisma, InteractionChannel, InteractionDirection } from "@prisma/client";
import { resolveClientFromEntities } from "./resolve-client";

// Accept both Prisma.TransactionClient and the extended db client (from $extends)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = { clientInteraction: { create: (...args: any[]) => any } } & Record<string, any>;

// ── Input Types ───────────────────────────────────────────────────────

export type LogInteractionInput = {
  category: string;
  summary: string;
  occurredAt?: Date;

  // Entity links (at least one should be provided)
  intakeLeadId?: string;
  pipelineLeadId?: string;
  proposalId?: string;
  deliveryProjectId?: string;
  dealId?: string;

  // Optional enrichment
  channel?: InteractionChannel;
  direction?: InteractionDirection;
  clientName?: string;
  clientEmail?: string;
  metaJson?: Record<string, unknown>;

  // Next action enforcement
  nextActionSummary?: string;
  nextActionDueAt?: Date;

  // Actor
  actorType?: string;
  actorId?: string;

  // Source deduplication
  sourceModel?: string;
  sourceId?: string;
};

// ── Core: Log Interaction ─────────────────────────────────────────────

export async function logInteraction(
  input: LogInteractionInput,
  tx?: DbClient
): Promise<{ id: string }> {
  const client: DbClient = tx ?? db;
  const now = input.occurredAt ?? new Date();

  // Auto-resolve client identity if not provided
  let { clientName, clientEmail } = input;
  if (!clientName && !clientEmail) {
    const resolved = await resolveClientFromEntities(
      {
        proposalId: input.proposalId,
        deliveryProjectId: input.deliveryProjectId,
        intakeLeadId: input.intakeLeadId,
        pipelineLeadId: input.pipelineLeadId,
        dealId: input.dealId,
      },
      client
    );
    clientName = resolved.clientName ?? undefined;
    clientEmail = resolved.clientEmail ?? undefined;
  }

  const record = await client.clientInteraction.create({
    data: {
      category: input.category,
      summary: input.summary,
      occurredAt: now,
      channel: input.channel,
      direction: input.direction ?? "outbound",
      clientName: clientName ?? undefined,
      clientEmail: clientEmail ?? undefined,
      metaJson: input.metaJson ? (input.metaJson as Prisma.InputJsonValue) : undefined,
      intakeLeadId: input.intakeLeadId,
      pipelineLeadId: input.pipelineLeadId,
      proposalId: input.proposalId,
      deliveryProjectId: input.deliveryProjectId,
      dealId: input.dealId,
      nextActionSummary: input.nextActionSummary,
      nextActionDueAt: input.nextActionDueAt,
      actorType: input.actorType,
      actorId: input.actorId,
      sourceModel: input.sourceModel,
      sourceId: input.sourceId,
    },
    select: { id: true },
  });

  return { id: record.id };
}

// ── Query: Client Timeline ────────────────────────────────────────────

export async function getClientTimeline(opts: {
  clientEmail?: string;
  pipelineLeadId?: string;
  intakeLeadId?: string;
  limit?: number;
}) {
  const where: Prisma.ClientInteractionWhereInput = {};
  if (opts.clientEmail) where.clientEmail = opts.clientEmail;
  if (opts.pipelineLeadId) where.pipelineLeadId = opts.pipelineLeadId;
  if (opts.intakeLeadId) where.intakeLeadId = opts.intakeLeadId;

  return db.clientInteraction.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    take: opts.limit ?? 100,
  });
}

// ── NBA Enforcement: Interactions Without Next Action ──────────────────

export async function getInteractionsWithoutNextAction(
  since: Date
): Promise<{ count: number; oldest: Date | null }> {
  const results = await db.clientInteraction.findMany({
    where: {
      nextActionDueAt: null,
      nextActionCompletedAt: null,
      occurredAt: { gte: since },
      direction: { not: "internal" },
    },
    orderBy: { occurredAt: "asc" },
    select: { occurredAt: true },
    take: 1,
  });

  const count = await db.clientInteraction.count({
    where: {
      nextActionDueAt: null,
      nextActionCompletedAt: null,
      occurredAt: { gte: since },
      direction: { not: "internal" },
    },
  });

  return {
    count,
    oldest: results[0]?.occurredAt ?? null,
  };
}

// ── Risk Enforcement: Interaction Gaps ────────────────────────────────

export async function getInteractionGaps(opts: {
  minDaysWithout: number;
  now?: Date;
}): Promise<{ clientName: string; clientEmail: string | null; daysSince: number }[]> {
  const now = opts.now ?? new Date();
  const threshold = new Date(now.getTime() - opts.minDaysWithout * 86400000);

  // Get the most recent interaction per clientEmail
  const latestPerClient = await db.clientInteraction.groupBy({
    by: ["clientEmail", "clientName"],
    _max: { occurredAt: true },
    where: {
      clientEmail: { not: null },
      direction: { not: "internal" },
    },
  });

  return latestPerClient
    .filter((c) => c._max.occurredAt && c._max.occurredAt < threshold)
    .map((c) => ({
      clientName: c.clientName ?? "Unknown",
      clientEmail: c.clientEmail,
      daysSince: Math.floor((now.getTime() - c._max.occurredAt!.getTime()) / 86400000),
    }))
    .sort((a, b) => b.daysSince - a.daysSince);
}

// ── Mark Next Action Complete ─────────────────────────────────────────

export async function completeNextAction(
  interactionId: string,
  completedAt?: Date
): Promise<void> {
  await db.clientInteraction.update({
    where: { id: interactionId },
    data: { nextActionCompletedAt: completedAt ?? new Date() },
  });
}
