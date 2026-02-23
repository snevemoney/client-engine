/**
 * Transcript Resolver — tries providers in priority order with retries and backoff.
 *
 * Provider order:
 *   1. TranscriptAPI (youtube-transcript packages)
 *   2. YouTube Captions (direct page scrape)
 *   3. yt-dlp (if available + enabled)
 *   4. Whisper (if available + enabled)
 *
 * If all fail, returns FAILED_TRANSCRIPT with aggregated error info.
 */

import type { ProviderResult, ProviderSuccess, TranscriptProvider } from "./types";
import { ytLog } from "./types";
import { transcriptApiProvider } from "./providers/transcriptApi";
import { youtubeCaptionsProvider } from "./providers/youtubeCaptions";
import { ytDlpProvider } from "./providers/ytDlp";
import { whisperProvider } from "./providers/whisper";

const DEFAULT_MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 1500;

type ResolverOptions = {
  maxRetries?: number;
  /** Skip specific providers by name (for testing or forced fallback). */
  skipProviders?: string[];
};

export type ResolverResult = {
  success: ProviderSuccess | null;
  attempts: number;
  providersTried: string[];
  errors: { provider: string; error: string; code: string }[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const ALL_PROVIDERS: TranscriptProvider[] = [
  transcriptApiProvider,
  youtubeCaptionsProvider,
  ytDlpProvider,
  whisperProvider,
];

/**
 * Resolve transcript for a video by trying providers in order.
 */
export async function resolveTranscript(
  videoId: string,
  opts?: ResolverOptions,
): Promise<ResolverResult> {
  const maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const skipSet = new Set(opts?.skipProviders ?? []);
  const result: ResolverResult = {
    success: null,
    attempts: 0,
    providersTried: [],
    errors: [],
  };

  for (const provider of ALL_PROVIDERS) {
    if (skipSet.has(provider.name)) continue;

    const isAvailable = await provider.available();
    if (!isAvailable) {
      ytLog("debug", `provider ${provider.name} not available, skipping`, { videoId });
      continue;
    }

    result.providersTried.push(provider.name);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      result.attempts++;

      if (attempt > 0) {
        const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
        ytLog("info", `retrying provider ${provider.name}`, { videoId, attempt, backoffMs: backoff });
        await sleep(backoff);
      }

      let providerResult: ProviderResult;
      try {
        providerResult = await provider.fetch(videoId);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push({ provider: provider.name, error: errMsg, code: "NETWORK_ERROR" });
        ytLog("warn", `provider ${provider.name} threw`, { videoId, attempt, error: errMsg });
        continue;
      }

      if (providerResult.ok) {
        result.success = providerResult;
        ytLog("info", "transcript resolved", {
          videoId,
          provider: providerResult.provider,
          segments: providerResult.segments.length,
          totalAttempts: result.attempts,
        });
        return result;
      }

      result.errors.push({
        provider: providerResult.provider,
        error: providerResult.error,
        code: providerResult.code,
      });

      // Don't retry for non-transient errors
      if (providerResult.code === "TRANSCRIPT_UNAVAILABLE" || providerResult.code === "NOT_CONFIGURED") {
        break;
      }
    }
  }

  ytLog("error", "all providers failed", {
    videoId,
    attempts: result.attempts,
    providers: result.providersTried,
    errors: result.errors,
  });

  return result;
}
