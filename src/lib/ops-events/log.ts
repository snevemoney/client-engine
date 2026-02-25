/**
 * Phase 2.7: Ops event logging.
 * Best-effort, never throws into primary business flow.
 */

import { db } from "@/lib/db";
import { sanitizeMeta, sanitizeErrorMessage, safeFingerprint } from "./sanitize";

export type OpsEventInput = {
  level?: "info" | "warn" | "error";
  category: "ui_action" | "api_action" | "page_view" | "system" | "audit" | "automation" | "integration" | "data_quality";
  status?: "started" | "success" | "failure" | "skipped";
  eventKey: string;
  eventLabel?: string;
  sourceType?: string;
  sourceId?: string;
  route?: string;
  method?: string;
  requestKey?: string;
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  meta?: unknown;
  fingerprint?: string;
  actorType?: string;
  actorId?: string;
  actorLabel?: string;
};

export async function logOpsEvent(input: OpsEventInput): Promise<void> {
  try {
    const meta = sanitizeMeta(input.meta);
    await db.opsEvent.create({
      data: {
        level: input.level ?? "info",
        category: input.category,
        status: input.status ?? "success",
        eventKey: input.eventKey,
        eventLabel: input.eventLabel ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        route: input.route ?? null,
        method: input.method ?? null,
        requestKey: input.requestKey ?? null,
        durationMs: input.durationMs ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        metaJson: meta ?? undefined,
        fingerprint: input.fingerprint ?? null,
        actorType: input.actorType ?? null,
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel ?? null,
      },
    });
  } catch {
    // Best-effort: never throw
  }
}

export function logOpsEventSafe(input: OpsEventInput): void {
  void logOpsEvent(input);
}

export async function timeAsync<T>(
  fn: () => Promise<T>,
  opts: { eventKey: string; category: OpsEventInput["category"]; route?: string; method?: string; sourceType?: string; sourceId?: string }
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    logOpsEventSafe({
      ...opts,
      eventKey: opts.eventKey,
      category: opts.category,
      status: "success",
      durationMs,
    });
    return { result, durationMs };
  } catch (e) {
    const durationMs = Date.now() - start;
    logOpsEventSafe({
      ...opts,
      eventKey: opts.eventKey,
      category: opts.category,
      status: "failure",
      durationMs,
      errorMessage: sanitizeErrorMessage(e),
    });
    throw e;
  }
}

export { safeFingerprint };
