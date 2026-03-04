/**
 * Shared API utilities for consistent auth, error handling, and observability.
 * Use across src/app/api routes for production hardening.
 */
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
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
  code?: string,
  extra?: { headers?: Record<string, string>; bodyExtra?: Record<string, unknown> }
): NextResponse {
  const body: Record<string, unknown> = { error: message };
  if (code) body.code = code;
  Object.assign(body, extra?.bodyExtra ?? {});
  const headers = new Headers(extra?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=utf-8");
  return new NextResponse(JSON.stringify(body), { status, headers });
}

/** Default rate limit for state-changing routes: 60 req/min per client. */
const STATE_CHANGE_RATE_LIMIT = { windowMs: 60_000, max: 60 };

/**
 * Check rate limit for state-changing routes (POST/PATCH/PUT/DELETE).
 * Returns null if allowed, or a NextResponse (429) if rate limited.
 * Use at the start of mutation handlers.
 */
export function checkStateChangeRateLimit(
  request: NextRequest,
  routeKey: string,
  userId?: string | null,
  opts?: { windowMs?: number; max?: number }
): NextResponse | null {
  const clientKey = getRequestClientKey(request, userId);
  const { windowMs, max } = { ...STATE_CHANGE_RATE_LIMIT, ...opts };
  const rl = rateLimitByKey({ key: `rl:${routeKey}:${clientKey}`, windowMs, max });
  if (!rl.ok) {
    return jsonError("Too many requests", 429, "RATE_LIMIT", {
      headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    });
  }
  return null;
}

/** Require auth; returns session or null. Use with jsonError("Unauthorized", 401) when null. */
export async function requireAuth(): Promise<Session | null> {
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    return session?.user ? (session as Session) : null;
  } catch (err) {
    console.warn("[requireAuth] auth() threw, treating as unauthenticated:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Per-resource access control: require auth + resource exists.
 * Single-tenant: no ownership field; any authenticated user can access.
 * Returns { session, resource } or a NextResponse error.
 */
export async function requireLeadAccess(
  leadId: string,
  opts?: { include?: Record<string, unknown> }
): Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { ok: true; session: Session; lead: any }
  | { ok: false; response: NextResponse }
> {
  const session = await requireAuth();
  if (!session) return { ok: false, response: jsonError("Unauthorized", 401) };

  const { db } = await import("@/lib/db");
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    ...(opts?.include ? { include: opts.include } : {}),
  });
  if (!lead) return { ok: false, response: jsonError("Lead not found", 404) };

  return { ok: true, session, lead };
}

/**
 * Per-resource access control: require auth + resource exists.
 * Single-tenant: no ownership field; any authenticated user can access.
 */
export async function requireProposalAccess(
  proposalId: string,
  opts?: { include?: Record<string, unknown> }
): Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { ok: true; session: Session; proposal: any }
  | { ok: false; response: NextResponse }
> {
  const session = await requireAuth();
  if (!session) return { ok: false, response: jsonError("Unauthorized", 401) };

  const { db } = await import("@/lib/db");
  const proposal = await db.proposal.findUnique({
    where: { id: proposalId },
    ...(opts?.include ? { include: opts.include } : {}),
  });
  if (!proposal) return { ok: false, response: jsonError("Proposal not found", 404) };

  return { ok: true, session, proposal };
}

/**
 * Shared auth + project lookup for delivery project API routes.
 * Returns { session, project } or a NextResponse error.
 * Callers should cast project to the expected type when using `include`.
 */
export async function requireDeliveryProject(
  projectId: string,
  opts?: { include?: Record<string, unknown> }
): Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { ok: true; session: Session; project: any }
  | { ok: false; response: NextResponse }
> {
  const session = await requireAuth();
  if (!session) return { ok: false, response: jsonError("Unauthorized", 401) };

  const { db } = await import("@/lib/db");
  const project = await db.deliveryProject.findUnique({
    where: { id: projectId },
    ...(opts?.include ? { include: opts.include } : {}),
  });
  if (!project) return { ok: false, response: jsonError("Project not found", 404) };

  return { ok: true, session, project };
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
