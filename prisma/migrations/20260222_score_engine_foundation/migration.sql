-- Phase 3.1: Score Engine Foundation — ScoreSnapshot + ScoreEvent

CREATE TABLE IF NOT EXISTS "ScoreSnapshot" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "band" TEXT NOT NULL,
    "delta" DOUBLE PRECISION,
    "factorsJson" JSONB,
    "reasonsJson" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ScoreSnapshot_entityType_entityId_computedAt_idx" ON "ScoreSnapshot"("entityType", "entityId", "computedAt" DESC);
CREATE INDEX IF NOT EXISTS "ScoreSnapshot_band_computedAt_idx" ON "ScoreSnapshot"("band", "computedAt" DESC);
CREATE INDEX IF NOT EXISTS "ScoreSnapshot_createdAt_idx" ON "ScoreSnapshot"("createdAt" DESC);

CREATE TABLE IF NOT EXISTS "ScoreEvent" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromScore" DOUBLE PRECISION NOT NULL,
    "toScore" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "fromBand" TEXT NOT NULL,
    "toBand" TEXT NOT NULL,
    "reasonsJson" JSONB,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ScoreEvent_dedupeKey_idx" ON "ScoreEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "ScoreEvent_entityType_entityId_createdAt_idx" ON "ScoreEvent"("entityType", "entityId", "createdAt" DESC);
