/**
 * YouTube Ingestion Pipeline — shared types.
 * Covers transcript providers, ingest jobs, learning proposals.
 */

// ---------------------------------------------------------------------------
// Transcript statuses (mirrors DB enum stored as string)
// ---------------------------------------------------------------------------

export const TRANSCRIPT_STATUS = {
  PENDING: "PENDING",
  FETCHING: "FETCHING",
  TRANSCRIBED: "TRANSCRIBED",
  FAILED_TRANSCRIPT: "FAILED_TRANSCRIPT",
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  PROMOTED_TO_PLAYBOOK: "PROMOTED_TO_PLAYBOOK",
  REJECTED: "REJECTED",
  KNOWLEDGE_ONLY: "KNOWLEDGE_ONLY",
} as const;

export type TranscriptStatus = (typeof TRANSCRIPT_STATUS)[keyof typeof TRANSCRIPT_STATUS];

// ---------------------------------------------------------------------------
// Provider result shape
// ---------------------------------------------------------------------------

export type TranscriptSegment = {
  text: string;
  start?: number;
  duration?: number;
};

export type VideoMeta = {
  videoId: string;
  title?: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
  durationSeconds?: number;
  language?: string;
};

export type ProviderSuccess = {
  ok: true;
  provider: string;
  segments: TranscriptSegment[];
  meta: VideoMeta;
  language?: string;
  confidence?: number;
};

export type ProviderFailure = {
  ok: false;
  provider: string;
  error: string;
  code: TranscriptErrorCode;
};

export type ProviderResult = ProviderSuccess | ProviderFailure;

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export type TranscriptErrorCode =
  | "INVALID_URL"
  | "TRANSCRIPT_UNAVAILABLE"
  | "PROVIDER_BLOCKED"
  | "RATE_LIMITED"
  | "PARSING_FAILED"
  | "NETWORK_ERROR"
  | "NOT_CONFIGURED"
  | "UNSUPPORTED";

// ---------------------------------------------------------------------------
// Source types
// ---------------------------------------------------------------------------

export type YouTubeSourceType = "video" | "channel";

export type NormalizedSource =
  | { type: "video"; videoId: string; normalizedUrl: string }
  | { type: "channel"; channelId?: string; handle?: string; normalizedUrl: string };

// ---------------------------------------------------------------------------
// Ingest job shapes
// ---------------------------------------------------------------------------

export type IngestJobSummary = {
  id: string;
  sourceType: YouTubeSourceType;
  status: TranscriptStatus;
  attempts: number;
  providerUsed: string | null;
  lastError: string | null;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type ChannelIngestRunSummary = {
  channelId: string;
  channelName?: string;
  totalFound: number;
  alreadyIngested: number;
  transcribed: number;
  failed: number;
  queuedForReview: number;
};

// ---------------------------------------------------------------------------
// Learning proposal categories + system areas
// ---------------------------------------------------------------------------

export const PROPOSAL_CATEGORIES = [
  "sales",
  "operations",
  "client_delivery",
  "positioning",
  "ai_tooling",
  "automation",
  "leadership",
  "hiring",
  "offer_design",
  "follow_up_retention",
] as const;

export type ProposalCategory = (typeof PROPOSAL_CATEGORIES)[number];

export const SYSTEM_AREAS = ["Acquire", "Deliver", "Improve"] as const;
export type SystemArea = (typeof SYSTEM_AREAS)[number];

export const PRODUCED_ASSET_TYPES = [
  "proposal_template",
  "sales_script",
  "followup_script",
  "objection_handling",
  "delivery_checklist",
  "reusable_component",
  "case_study_angle",
  "positioning_note",
  "knowledge_only",
] as const;

export type ProducedAssetType = (typeof PRODUCED_ASSET_TYPES)[number];

export const EXPECTED_IMPACTS = ["acquire", "deliver", "improve"] as const;
export type ExpectedImpact = (typeof EXPECTED_IMPACTS)[number];

// ---------------------------------------------------------------------------
// Transcript provider interface
// ---------------------------------------------------------------------------

export interface TranscriptProvider {
  name: string;
  available(): Promise<boolean> | boolean;
  fetch(videoId: string): Promise<ProviderResult>;
}

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

export type LogLevel = "info" | "warn" | "error" | "debug";

export function ytLog(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
  const entry = { ts: new Date().toISOString(), level, msg, ...data };
  if (level === "error") {
    console.error("[youtube]", JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn("[youtube]", JSON.stringify(entry));
  } else {
    console.log("[youtube]", JSON.stringify(entry));
  }
}
