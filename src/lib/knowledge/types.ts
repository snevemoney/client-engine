/**
 * Knowledge Engine: artifact types and metadata for YouTube ingestion and self-improvement.
 * No new DB tables; uses Lead + Artifact with system lead "Knowledge Engine Runs".
 */

export const KNOWLEDGE_ARTIFACT_TYPES = {
  YOUTUBE_VIDEO_TRANSCRIPT: "YOUTUBE_VIDEO_TRANSCRIPT",
  YOUTUBE_VIDEO_SUMMARY: "YOUTUBE_VIDEO_SUMMARY",
  YOUTUBE_CHANNEL_INDEX: "YOUTUBE_CHANNEL_INDEX",
  KNOWLEDGE_INSIGHT: "KNOWLEDGE_INSIGHT",
  IMPROVEMENT_SUGGESTION: "IMPROVEMENT_SUGGESTION",
  KNOWLEDGE_RUN_REPORT: "KNOWLEDGE_RUN_REPORT",
  /** Pending URLs to ingest during workday run (Phase 6). */
  PENDING_KNOWLEDGE_URL: "PENDING_KNOWLEDGE_URL",
} as const;

export type KnowledgeArtifactMetaBase = {
  sourceUrl?: string;
  channelName?: string;
  channelId?: string;
  videoTitle?: string;
  videoId?: string;
  publishedAt?: string;
  capturedAt: string;
  tags?: string[];
  confidence?: number;
};

export type KnowledgeInsightCategory =
  | "sales"
  | "ops"
  | "marketing"
  | "delivery"
  | "offer"
  | "automation"
  | "constraint"
  | "mindset";

export type KnowledgeInsightMeta = KnowledgeArtifactMetaBase & {
  categories: KnowledgeInsightCategory[];
  principle?: boolean;
  tactical?: boolean;
  warning?: boolean;
  metricsIdea?: boolean;
  bottleneckIdea?: boolean;
  websiteMonetization?: boolean;
  proposalSales?: boolean;
};

export type ImprovementSuggestionSystemArea =
  | "Leads"
  | "Proposals"
  | "Metrics"
  | "Chatbot"
  | "Website"
  | "Command Center"
  | "Research"
  | "Pipeline"
  | "Other";

export type ImprovementSuggestionEffort = "S" | "M" | "L";

export type ConfidenceTier = "high" | "medium" | "low";

export type ImprovementSuggestionMeta = KnowledgeArtifactMetaBase & {
  problem: string;
  proposedChange: string;
  expectedImpact: string;
  effort: ImprovementSuggestionEffort;
  systemArea: ImprovementSuggestionSystemArea;
  sourceTranscriptRef?: string;
  sourceArtifactId?: string;
  status: "queued" | "reviewed" | "applied" | "dismissed";
  /** Source quality / confidence tier for curation. */
  confidenceTier?: ConfidenceTier;
};

export type KnowledgeRunReport = {
  ok: boolean;
  at: string;
  sourceType: "video" | "channel";
  videoUrl?: string;
  channelUrl?: string;
  channelName?: string;
  discovered?: number;
  ingested: number;
  skipped: number;
  errors: string[];
  artifactIds: string[];
};
