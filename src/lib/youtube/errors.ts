/**
 * Structured error classes for the YouTube ingestion pipeline.
 * Each error type carries a code for programmatic handling + human-readable message.
 */

import type { TranscriptErrorCode } from "./types";

export class YouTubeIngestionError extends Error {
  readonly code: TranscriptErrorCode;
  readonly provider?: string;
  readonly videoId?: string;

  constructor(
    message: string,
    code: TranscriptErrorCode,
    opts?: { provider?: string; videoId?: string; cause?: unknown },
  ) {
    super(message);
    this.name = "YouTubeIngestionError";
    this.code = code;
    this.provider = opts?.provider;
    this.videoId = opts?.videoId;
    if (opts?.cause) this.cause = opts.cause;
  }
}

export class ProviderBlockedError extends YouTubeIngestionError {
  constructor(provider: string, detail?: string) {
    super(
      `Provider "${provider}" is blocked or rate-limited${detail ? `: ${detail}` : ""}`,
      "PROVIDER_BLOCKED",
      { provider },
    );
    this.name = "ProviderBlockedError";
  }
}

export class TranscriptUnavailableError extends YouTubeIngestionError {
  constructor(videoId: string, reason?: string) {
    super(
      `Transcript unavailable for ${videoId}${reason ? `: ${reason}` : ""}`,
      "TRANSCRIPT_UNAVAILABLE",
      { videoId },
    );
    this.name = "TranscriptUnavailableError";
  }
}

export class ParsingFailedError extends YouTubeIngestionError {
  constructor(provider: string, detail?: string) {
    super(
      `Parsing failed in provider "${provider}"${detail ? `: ${detail}` : ""}`,
      "PARSING_FAILED",
      { provider },
    );
    this.name = "ParsingFailedError";
  }
}

export class RateLimitError extends YouTubeIngestionError {
  constructor(provider: string, retryAfterMs?: number) {
    super(
      `Rate limited by "${provider}"${retryAfterMs ? ` (retry after ${retryAfterMs}ms)` : ""}`,
      "RATE_LIMITED",
      { provider },
    );
    this.name = "RateLimitError";
  }
}

export class NetworkError extends YouTubeIngestionError {
  constructor(detail: string, provider?: string) {
    super(`Network error: ${detail}`, "NETWORK_ERROR", { provider });
    this.name = "NetworkError";
  }
}
