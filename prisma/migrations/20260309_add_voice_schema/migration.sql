-- Voice Phase 1: Proposal follow-up (contactPhone, consent, opt-out) + VoiceCallLog
-- See docs/VOICE_ASSISTANT_PHASE_1_MVP.md

-- Proposal: voice fields
ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "voiceConsentAt" TIMESTAMP(3);
ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "voiceOptedOutAt" TIMESTAMP(3);

-- VoiceCallOutcome enum
DO $$ BEGIN
  CREATE TYPE "VoiceCallOutcome" AS ENUM (
    'booked_callback',
    'requested_manual_followup',
    'not_interested',
    'no_answer',
    'opted_out'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- VoiceCallLog table
CREATE TABLE IF NOT EXISTS "VoiceCallLog" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "pipelineLeadId" TEXT,
    "contactPhone" TEXT NOT NULL,
    "outcome" "VoiceCallOutcome" NOT NULL,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSeconds" INTEGER,
    "externalCallId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceCallLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VoiceCallLog_externalCallId_key" ON "VoiceCallLog"("externalCallId");
CREATE INDEX IF NOT EXISTS "VoiceCallLog_proposalId_idx" ON "VoiceCallLog"("proposalId");
CREATE INDEX IF NOT EXISTS "VoiceCallLog_calledAt_idx" ON "VoiceCallLog"("calledAt");
CREATE INDEX IF NOT EXISTS "VoiceCallLog_externalCallId_idx" ON "VoiceCallLog"("externalCallId");

ALTER TABLE "VoiceCallLog" DROP CONSTRAINT IF EXISTS "VoiceCallLog_proposalId_fkey";
ALTER TABLE "VoiceCallLog" ADD CONSTRAINT "VoiceCallLog_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
