-- Hardening 2026-08-27: money columns as integer cents + hot-path indexes.

ALTER TABLE "ContentAsset"
  ALTER COLUMN "cashCollected" SET DATA TYPE INTEGER
  USING ROUND("cashCollected" * 100)::INTEGER;

ALTER TABLE "NetworkingEvent"
  ALTER COLUMN "revenue" SET DATA TYPE INTEGER
  USING CASE
    WHEN "revenue" IS NULL THEN NULL
    ELSE ROUND("revenue" * 100)::INTEGER
  END;

CREATE INDEX IF NOT EXISTS "Artifact_leadId_type_idx" ON "Artifact"("leadId", "type");
CREATE INDEX IF NOT EXISTS "Artifact_type_idx" ON "Artifact"("type");
CREATE INDEX IF NOT EXISTS "Lead_dealOutcome_idx" ON "Lead"("dealOutcome");
CREATE INDEX IF NOT EXISTS "JobRun_lockedAt_idx" ON "JobRun"("lockedAt");
CREATE INDEX IF NOT EXISTS "NetworkingEvent_eventDate_idx" ON "NetworkingEvent"("eventDate");
