/**
 * Learning Engine: types for YouTube ingest, transcripts, and improvement proposals.
 * All stored as Artifact (no new DB tables).
 */

export const LEARNING_ARTIFACT_TYPES = {
  YOUTUBE_VIDEO: "youtube_video",
  YOUTUBE_TRANSCRIPT: "youtube_transcript",
  LEARNING_SUMMARY: "learning_summary",
  LEARNING_PRINCIPLES: "learning_principles",
  LEARNING_ACTIONS: "learning_actions",
  ENGINE_IMPROVEMENT_PROPOSAL: "engine_improvement_proposal",
  LEARNING_RUN_REPORT: "learning_run_report",
} as const;

export type LearningMetaBase = {
  sourceType: "youtube";
  videoUrl?: string;
  videoId?: string;
  channelName?: string;
  channelId?: string;
  publishedAt?: string;
  capturedAt: string;
  tags?: string[];
  confidence?: number;
};

export type EngineImprovementProposal = {
  title: string;
  sourceVideo?: string;
  sourceChannel?: string;
  insightType:
    | "sales"
    | "ops"
    | "marketing"
    | "finance"
    | "product"
    | "mindset"
    | "positioning"
    | "metrics";
  problemObserved: string;
  principle: string;
  proposedChange: string;
  expectedImpact: string;
  effort: "low" | "med" | "high";
  risk: "low" | "med" | "high";
  metricToTrack?: string;
  rollbackPlan?: string;
  applyTarget?:
    | "prompt"
    | "workflow"
    | "ui"
    | "scorecard"
    | "playbook"
    | "automation";
};

export type VideoMetadata = {
  videoId: string;
  title: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
};

export type TranscriptSegment = {
  text: string;
  start?: number;
  duration?: number;
};

export type IngestVideoInput = {
  videoUrl: string;
  tags?: string[];
};

export type IngestChannelInput = {
  channelUrl: string;
  maxVideos?: number;
  tags?: string[];
};

export type LearningRunReport = {
  ok: boolean;
  at: string;
  sourceType: "video" | "channel";
  videoUrl?: string;
  channelUrl?: string;
  discovered?: number;
  ingested: number;
  skipped: number;
  errors: string[];
  artifactIds: string[];
};
