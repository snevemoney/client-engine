-- YouTube Ingestion Pipeline: additive migration (safe, no drops)

-- YouTubeSource: a video or channel submitted for ingestion
CREATE TABLE IF NOT EXISTS "YouTubeSource" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT,
    "channelName" TEXT,
    "channelId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "YouTubeSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "YouTubeSource_externalId_key" ON "YouTubeSource"("externalId");
CREATE INDEX IF NOT EXISTS "YouTubeSource_type_idx" ON "YouTubeSource"("type");
CREATE INDEX IF NOT EXISTS "YouTubeSource_externalId_idx" ON "YouTubeSource"("externalId");

-- YouTubeIngestJob: tracks a single ingest attempt
CREATE TABLE IF NOT EXISTS "YouTubeIngestJob" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerUsed" TEXT,
    "lastError" TEXT,
    "runSummaryJson" JSONB,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "YouTubeIngestJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "YouTubeIngestJob_status_idx" ON "YouTubeIngestJob"("status");
CREATE INDEX IF NOT EXISTS "YouTubeIngestJob_sourceId_idx" ON "YouTubeIngestJob"("sourceId");
CREATE INDEX IF NOT EXISTS "YouTubeIngestJob_queuedAt_idx" ON "YouTubeIngestJob"("queuedAt");

ALTER TABLE "YouTubeIngestJob"
    ADD CONSTRAINT "YouTubeIngestJob_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "YouTubeSource"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- YouTubeTranscript: the actual transcript content + metadata
CREATE TABLE IF NOT EXISTS "YouTubeTranscript" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "channelId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT,
    "transcriptText" TEXT NOT NULL,
    "transcriptSegmentsJson" JSONB,
    "language" TEXT,
    "durationSeconds" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "providerUsed" TEXT NOT NULL,
    "transcriptHash" TEXT,
    "transcriptStatus" TEXT NOT NULL DEFAULT 'TRANSCRIBED',
    "failureReason" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "YouTubeTranscript_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "YouTubeTranscript_videoId_key" ON "YouTubeTranscript"("videoId");
CREATE INDEX IF NOT EXISTS "YouTubeTranscript_channelId_idx" ON "YouTubeTranscript"("channelId");
CREATE INDEX IF NOT EXISTS "YouTubeTranscript_transcriptStatus_idx" ON "YouTubeTranscript"("transcriptStatus");
CREATE INDEX IF NOT EXISTS "YouTubeTranscript_providerUsed_idx" ON "YouTubeTranscript"("providerUsed");

-- LearningProposal: human-gated proposal derived from a transcript
CREATE TABLE IF NOT EXISTS "LearningProposal" (
    "id" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "extractedPointsJson" JSONB,
    "category" TEXT,
    "systemArea" TEXT,
    "contradictionFlagsJson" JSONB,
    "proposedActionsJson" JSONB,
    "producedAssetType" TEXT,
    "expectedImpact" TEXT,
    "revenueLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY_FOR_REVIEW',
    "reviewerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LearningProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LearningProposal_status_idx" ON "LearningProposal"("status");
CREATE INDEX IF NOT EXISTS "LearningProposal_transcriptId_idx" ON "LearningProposal"("transcriptId");
CREATE INDEX IF NOT EXISTS "LearningProposal_category_idx" ON "LearningProposal"("category");
CREATE INDEX IF NOT EXISTS "LearningProposal_systemArea_idx" ON "LearningProposal"("systemArea");

ALTER TABLE "LearningProposal"
    ADD CONSTRAINT "LearningProposal_transcriptId_fkey"
    FOREIGN KEY ("transcriptId") REFERENCES "YouTubeTranscript"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
