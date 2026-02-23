/**
 * Shared API utilities for consistent auth, error handling, and observability.
 * Use across src/app/api routes for production hardening.
 */
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

const SLOW_ROUTE_MS = 1000;

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

/** Wrap a route handler with timing + slow-route log. Returns the handler's Response. */
export async function withRouteTiming(
  routeLabel: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const start = Date.now();
  try {
    const res = await handler();
    const ms = Date.now() - start;
    if (ms > SLOW_ROUTE_MS) {
      console.warn(`[api:slow] ${routeLabel} took ${ms}ms`);
    }
    return res;
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`[api:error] ${routeLabel} failed after ${ms}ms`, err);
    throw err;
  }
}
