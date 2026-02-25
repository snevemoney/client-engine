/**
 * Phase 2.7: Audit action logging.
 * Best-effort, never throws into primary business flow.
 */

import { db } from "@/lib/db";
import { sanitizeMeta } from "@/lib/ops-events/sanitize";

export type AuditActionInput = {
  actionKey: string;
  actionLabel: string;
  sourceType: string;
  sourceId: string;
  sourceLabel?: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  note?: string;
  actorId?: string;
  actorLabel?: string;
  metaJson?: unknown;
};

export function sanitizeAuditPayload(obj: unknown): Record<string, unknown> | null {
  return sanitizeMeta(obj);
}

export function buildChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  allowlist?: string[]
): Record<string, { before: unknown; after: unknown }> {
  const keys = allowlist ?? [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const out: Record<string, { before: unknown; after: unknown }> = {};
  for (const k of keys) {
    const b = before[k];
    const a = after[k];
    if (b === a) continue;
    out[k] = { before: b, after: a };
  }
  return out;
}

export async function createAuditAction(input: AuditActionInput): Promise<void> {
  try {
    const before = sanitizeAuditPayload(input.beforeJson);
    const after = sanitizeAuditPayload(input.afterJson);
    const meta = sanitizeAuditPayload(input.metaJson);
    await db.auditAction.create({
      data: {
        actionKey: input.actionKey,
        actionLabel: input.actionLabel,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceLabel: input.sourceLabel ?? null,
        beforeJson: before ?? undefined,
        afterJson: after ?? undefined,
        note: input.note ?? null,
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel ?? null,
        metaJson: meta ?? undefined,
      },
    });
  } catch {
    // Best-effort: never throw
  }
}

export function createAuditActionSafe(input: AuditActionInput): void {
  void createAuditAction(input);
}
