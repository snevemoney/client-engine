-- Phase 4.2: NBA Delivery Paths — NextActionExecution + execution/snooze fields on NextBestAction

-- Add snooze and execution audit fields to NextBestAction
ALTER TABLE "NextBestAction" ADD COLUMN IF NOT EXISTS "snoozedUntil" TIMESTAMP(3);
ALTER TABLE "NextBestAction" ADD COLUMN IF NOT EXISTS "lastExecutedAt" TIMESTAMP(3);
ALTER TABLE "NextBestAction" ADD COLUMN IF NOT EXISTS "lastExecutionStatus" TEXT;
ALTER TABLE "NextBestAction" ADD COLUMN IF NOT EXISTS "lastExecutionErrorCode" TEXT;
ALTER TABLE "NextBestAction" ADD COLUMN IF NOT EXISTS "lastExecutionErrorMessage" TEXT;

-- Create NextActionExecution audit table
CREATE TABLE IF NOT EXISTS "NextActionExecution" (
    "id" TEXT NOT NULL,
    "nextActionId" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metaJson" JSONB,
    CONSTRAINT "NextActionExecution_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NextActionExecution_nextActionId_fkey" FOREIGN KEY ("nextActionId") REFERENCES "NextBestAction"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NextActionExecution_nextActionId_idx" ON "NextActionExecution"("nextActionId");
CREATE INDEX IF NOT EXISTS "NextActionExecution_actionKey_startedAt_idx" ON "NextActionExecution"("actionKey", "startedAt" DESC);
