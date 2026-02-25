/**
 * Phase 2.8.6: Email channel — stub/manual. No external send unless configured.
 */

import type { ChannelAdapterResult, SendPayload } from "../types";

export async function sendEmail(
  _payload: SendPayload,
  config: Record<string, unknown>
): Promise<ChannelAdapterResult> {
  const to = config.to as string | undefined;
  if (!to || typeof to !== "string") {
    return { ok: false, error: "Email recipient not configured" };
  }
  // No actual send; manual-first. Return queue-only status.
  return {
    ok: false,
    error: "Email not configured for external send. Use in-app or webhook.",
  };
}
