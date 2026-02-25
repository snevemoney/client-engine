/**
 * Shared API utilities for consistent auth, error handling, and observability.
 * Use across src/app/api routes for production hardening.
 */
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { logSlow, PERF } from "@/lib/perf";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";

export type OpsEventConfig = {
  eventKey: string;
  method?: string;
  sourceType?: string;
  sourceId?: string;
};

/** Standard error response shape: { error: string, code?: string } */
export function jsonError(
  message: string,
  status: number,
  code?: string
): NextResponse {
  const body: { error: string; code?: string } = { error: message };
  if (code) body.code = code;
  return NextResponse.json(body, { status });
}

/** Require auth; returns session or null. Use with jsonError("Unauthorized", 401) when null. */
export async function requireAuth(): Promise<Session | null> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  return session?.user ? (session as Session) : null;
}

/** Wrap a route handler with timing + slow-route log. Uses [SLOW] format at 500ms. */
export async function withRouteTiming(
  routeLabel: string,
  handler: () => Promise<NextResponse>,
  opsConfig?: OpsEventConfig
): Promise<NextResponse> {
  const start = Date.now();
  try {
    const res = await handler();
    const ms = Date.now() - start;
    if (ms > PERF.SLOW_API_MS) {
      logSlow("api", routeLabel, ms);
    }
    if (opsConfig) {
      logOpsEventSafe({
        category: "api_action",
        eventKey: opsConfig.eventKey,
        eventLabel: routeLabel,
        route: routeLabel,
        method: opsConfig.method ?? "GET",
        status: res.ok ? "success" : "failure",
        durationMs: ms,
        sourceType: opsConfig.sourceType,
        sourceId: opsConfig.sourceId,
        level: res.ok ? "info" : "error",
      });
    }
    return res;
  } catch (err) {
    const ms = Date.now() - start;
    logSlow("api", routeLabel, ms, `error=${err instanceof Error ? err.message : "unknown"}`);
    if (opsConfig) {
      logOpsEventSafe({
        category: "api_action",
        eventKey: opsConfig.eventKey,
        eventLabel: routeLabel,
        route: routeLabel,
        method: opsConfig.method ?? "GET",
        status: "failure",
        durationMs: ms,
        errorMessage: sanitizeErrorMessage(err),
        sourceType: opsConfig.sourceType,
        sourceId: opsConfig.sourceId,
        level: "error",
      });
    }
    console.error(`[api:error] ${routeLabel} failed after ${ms}ms`, err);
    throw err;
  }
}
