/**
 * Shared cron route authentication helpers.
 * Supports Bearer AGENT_CRON_SECRET for automated callers
 * and NextAuth session for manual operator triggers.
 */
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Returns true if the request carries a valid AGENT_CRON_SECRET Bearer token
 * OR an authenticated session (for manual dashboard triggers).
 */
export async function isCronAllowed(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.AGENT_CRON_SECRET;
  if (cronSecret && authHeader?.startsWith("Bearer ")) {
    if (authHeader.slice(7) === cronSecret) return true;
  }
  const session = await auth();
  return !!session?.user;
}

/**
 * Like isCronAllowed but also accepts RESEARCH_CRON_SECRET.
 * Used by the health endpoint which serves both cron systems.
 */
export async function isMultiCronAllowed(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (process.env.AGENT_CRON_SECRET && token === process.env.AGENT_CRON_SECRET) return true;
    if (process.env.RESEARCH_CRON_SECRET && token === process.env.RESEARCH_CRON_SECRET) return true;
  }
  const session = await auth();
  return !!session?.user;
}

/**
 * Authenticate cron or session caller — returns userId/`"cron"` or null.
 * Used by routes that need to track the actor (e.g. agent runner).
 */
export async function authenticateCronOrSession(
  req: NextRequest
): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.AGENT_CRON_SECRET;
  if (cronSecret && authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === cronSecret) return "cron";
  }
  const session = await auth();
  if (session?.user?.id) return session.user.id;
  return null;
}
