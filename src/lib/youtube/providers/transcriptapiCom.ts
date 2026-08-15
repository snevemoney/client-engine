/**
 * TranscriptAPI.com — paid SaaS provider.
 * Uses TRANSCRIPTAPI_API_KEY. When set, tried first for reliability.
 * API: https://transcriptapi.com/api/v2/youtube/transcript
 *
 * Retries on 408, 429, 503 per spec (Retry-After for 429, 1–5s for 408/503).
 * Non-retryable: 400, 401, 402, 404, 422.
 */

import type { TranscriptProvider, ProviderResult, TranscriptSegment, VideoMeta } from "../types";
import { ytLog } from "../types";

const PROVIDER_NAME = "transcriptapi-com";
const BASE = "https://transcriptapi.com/api/v2";
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseErrorBody(body: string): string {
  try {
    const j = JSON.parse(body) as { detail?: string | { message?: string } };
    if (typeof j.detail === "string") return j.detail;
    if (j.detail && typeof j.detail === "object" && j.detail.message) return j.detail.message;
  } catch {
    /* ignore */
  }
  return body.slice(0, 200);
}

export const transcriptapiComProvider: TranscriptProvider = {
  name: PROVIDER_NAME,

  available() {
    return !!process.env.TRANSCRIPTAPI_API_KEY;
  },

  async fetch(videoId: string): Promise<ProviderResult> {
    const key = process.env.TRANSCRIPTAPI_API_KEY;
    if (!key) {
      return { ok: false, provider: PROVIDER_NAME, error: "TRANSCRIPTAPI_API_KEY not set", code: "NOT_CONFIGURED" };
    }

    const url = `${BASE}/youtube/transcript?video_url=${encodeURIComponent(videoId)}&format=json&include_timestamp=true&send_metadata=true`;

    let lastErr: ProviderResult | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(30_000),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            video_id?: string;
            language?: string;
            transcript?: Array<{ text: string; start?: number; duration?: number }>;
            metadata?: { title?: string; author_name?: string; author_url?: string };
          };

          const raw = data.transcript ?? [];
          if (raw.length === 0) {
            return {
              ok: false,
              provider: PROVIDER_NAME,
              error: "No transcript segments returned",
              code: "TRANSCRIPT_UNAVAILABLE",
            };
          }

          const segments: TranscriptSegment[] = raw.map((s) => ({
            text: s.text ?? "",
            start: s.start,
            duration: s.duration,
          }));

          const meta: VideoMeta = {
            videoId: data.video_id ?? videoId,
            title: data.metadata?.title,
            channelTitle: data.metadata?.author_name,
            language: data.language ?? undefined,
          };

          ytLog("info", "transcriptapi-com success", { videoId, segments: segments.length });
          return { ok: true, provider: PROVIDER_NAME, segments, meta, language: data.language };
        }

        const body = await res.text();
        const errMsg = parseErrorBody(body);

        // Non-retryable
        if ([400, 401, 402, 404, 422].includes(res.status)) {
          const code =
            res.status === 401 ? "NOT_CONFIGURED" : res.status === 402 ? "TRANSCRIPT_UNAVAILABLE" : "TRANSCRIPT_UNAVAILABLE";
          return {
            ok: false,
            provider: PROVIDER_NAME,
            error: `HTTP ${res.status}: ${res.status === 402 ? "Payment required (credits exhausted or no plan)" : errMsg}`,
            code,
          };
        }

        // Retryable: 408, 429, 503
        if (attempt < MAX_RETRIES && [408, 429, 503].includes(res.status)) {
          const retryAfter = res.status === 429 ? parseInt(res.headers.get("Retry-After") ?? "5", 10) * 1000 : 2000;
          const delay = Math.min(retryAfter, 8000);
          ytLog("info", "transcriptapi-com retryable error, backing off", {
            videoId,
            status: res.status,
            attempt,
            delayMs: delay,
          });
          await sleep(delay);
          lastErr = {
            ok: false,
            provider: PROVIDER_NAME,
            error: `HTTP ${res.status}: ${errMsg}`,
            code: res.status === 429 ? "RATE_LIMITED" : "TRANSCRIPT_UNAVAILABLE",
          };
          continue;
        }

        return {
          ok: false,
          provider: PROVIDER_NAME,
          error: `HTTP ${res.status}: ${errMsg}`,
          code: res.status === 429 ? "RATE_LIMITED" : "TRANSCRIPT_UNAVAILABLE",
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastErr = {
          ok: false,
          provider: PROVIDER_NAME,
          error: msg,
          code: msg.includes("timeout") || msg.includes("aborted") ? "NETWORK_ERROR" : "TRANSCRIPT_UNAVAILABLE",
        };
        if (attempt < MAX_RETRIES) {
          ytLog("info", "transcriptapi-com network error, retrying", { videoId, attempt, error: msg });
          await sleep(1500 * attempt);
        } else {
          ytLog("warn", "transcriptapi-com failed", { videoId, error: msg });
          return lastErr;
        }
      }
    }

    return lastErr ?? {
      ok: false,
      provider: PROVIDER_NAME,
      error: "Max retries exceeded",
      code: "TRANSCRIPT_UNAVAILABLE",
    };
  },
};
