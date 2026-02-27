/**
 * Server-side analytics via PostHog. All functions are fire-and-forget
 * and return immediately when NEXT_PUBLIC_POSTHOG_KEY is not set.
 */

import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  if (_client) return _client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  _client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return _client;
}

export type PipelineEvent =
  | "lead_created"
  | "lead_enriched"
  | "lead_scored"
  | "lead_positioned"
  | "lead_proposed"
  | "lead_approved"
  | "lead_rejected"
  | "deal_won"
  | "deal_lost"
  | "pipeline_run_completed"
  | "pipeline_step_failed";

export function trackPipelineEvent(
  leadId: string,
  event: PipelineEvent,
  properties?: Record<string, unknown>,
): void {
  const client = getClient();
  if (!client) return;
  client.capture({
    distinctId: `lead:${leadId}`,
    event,
    properties: { leadId, ...properties },
  });
}

export function trackPipelineStep(
  leadId: string,
  stepName: string,
  durationMs: number,
  success: boolean,
): void {
  const client = getClient();
  if (!client) return;
  client.capture({
    distinctId: `lead:${leadId}`,
    event: success ? "pipeline_step_completed" : "pipeline_step_failed",
    properties: { leadId, stepName, durationMs, success },
  });
}

export async function isFeatureEnabled(
  flagKey: string,
  distinctId: string = "system",
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  try {
    return (await client.isFeatureEnabled(flagKey, distinctId)) ?? false;
  } catch {
    return false;
  }
}

export async function shutdownAnalytics(): Promise<void> {
  if (_client) await _client.shutdown();
}
