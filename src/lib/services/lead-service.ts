/**
 * Phase 2: Lead service — list, create, getById, update, delete.
 * Extracted from /api/leads routes and brain executor for use by routes and agents.
 */

import { db } from "@/lib/db";
import type { LeadStatus } from "@prisma/client";

export type LeadListOptions = {
  status?: LeadStatus;
  source?: string;
  verdict?: "ACCEPT" | "MAYBE" | "REJECT";
  search?: string;
  limit?: number;
};

const DEFAULT_LIST_INCLUDE = {
  _count: { select: { artifacts: true } },
  proposals: {
    select: { id: true, status: true },
    orderBy: { updatedAt: "desc" as const },
    take: 1,
  },
  deliveryProjects: {
    select: { id: true, status: true },
    orderBy: { updatedAt: "desc" as const },
    take: 1,
  },
};

export async function list(options: LeadListOptions = {}) {
  const limit = Math.min(500, Math.max(1, options.limit ?? 500));
  const where: Record<string, unknown> = {};
  if (options.status) where.status = options.status;
  if (options.source) where.source = options.source;
  if (options.verdict && ["ACCEPT", "MAYBE", "REJECT"].includes(options.verdict)) {
    where.scoreVerdict = options.verdict;
  }
  if (options.search) {
    where.OR = [
      { title: { contains: options.search, mode: "insensitive" as const } },
      { description: { contains: options.search, mode: "insensitive" as const } },
    ];
  }

  const leads = await db.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: DEFAULT_LIST_INCLUDE,
  });
  return leads;
}

export type LeadCreateInput = {
  title: string;
  source?: string;
  sourceUrl?: string | null;
  description?: string | null;
  budget?: string | null;
  timeline?: string | null;
  platform?: string | null;
  techStack?: string[];
  contactName?: string | null;
  contactEmail?: string | null;
  tags?: string[];
};

export async function create(data: LeadCreateInput) {
  return db.lead.create({
    data: {
      title: data.title,
      source: data.source ?? "manual",
      sourceUrl: data.sourceUrl ?? undefined,
      description: data.description ?? undefined,
      budget: data.budget ?? undefined,
      timeline: data.timeline ?? undefined,
      platform: data.platform ?? undefined,
      techStack: data.techStack ?? [],
      contactName: data.contactName ?? undefined,
      contactEmail: data.contactEmail ?? undefined,
      tags: data.tags ?? [],
    },
  });
}

const DEFAULT_GET_INCLUDE = {
  artifacts: { orderBy: { createdAt: "desc" as const } },
  project: true,
  touches: { orderBy: { createdAt: "desc" as const } },
  referralsReceived: { orderBy: { createdAt: "desc" as const } },
  promotedFromIntake: {
    select: { id: true, title: true, source: true, status: true, score: true, createdAt: true },
  },
  proposals: {
    select: { id: true, title: true, status: true, sentAt: true, createdAt: true },
    orderBy: { createdAt: "desc" as const },
    take: 10,
  },
  deliveryProjects: {
    select: { id: true, title: true, status: true, dueDate: true, completedAt: true },
    orderBy: { createdAt: "desc" as const },
    take: 10,
  },
};

export async function getById(id: string, opts?: { include?: Record<string, unknown> }) {
  const include = opts?.include ?? DEFAULT_GET_INCLUDE;
  return db.lead.findUnique({
    where: { id },
    include,
  });
}

/** Agent-friendly update: allows status, description, score, scoreReason. */
export type LeadUpdateInput = Record<string, unknown>;

export async function update(id: string, data: LeadUpdateInput) {
  return db.lead.update({
    where: { id },
    data: data as Record<string, unknown>,
  });
}

export async function deleteLead(id: string) {
  return db.lead.delete({ where: { id } });
}

/** Brain executor list shape: compact fields, limit 50. */
export async function listForAgent(options: { status?: string; limit?: number } = {}) {
  const limit = Math.min((options.limit as number) || 20, 50);
  const where: Record<string, unknown> = {};
  if (options.status) where.status = options.status;

  const leads = await db.lead.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      source: true,
      contactName: true,
      contactEmail: true,
      score: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return { count: leads.length, leads };
}
