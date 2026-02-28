-- Phase 7.3: Outcome Attribution

-- AlterEnum (OperatorMemoryOutcome: add improved, worsened)
ALTER TYPE "OperatorMemoryOutcome" ADD VALUE 'improved';
ALTER TYPE "OperatorMemoryOutcome" ADD VALUE 'worsened';

-- CreateEnum
CREATE TYPE "OperatorAttributionSourceType" AS ENUM ('nba_execute', 'copilot_action');

-- CreateTable
CREATE TABLE "OperatorAttribution" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "sourceType" "OperatorAttributionSourceType" NOT NULL,
    "ruleKey" TEXT,
    "actionKey" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "beforeJson" JSONB NOT NULL DEFAULT '{}',
    "afterJson" JSONB NOT NULL DEFAULT '{}',
    "deltaJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "OperatorAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperatorAttribution_actorUserId_occurredAt_idx" ON "OperatorAttribution"("actorUserId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "OperatorAttribution_actorUserId_ruleKey_occurredAt_idx" ON "OperatorAttribution"("actorUserId", "ruleKey", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "OperatorAttribution_actorUserId_sourceType_occurredAt_idx" ON "OperatorAttribution"("actorUserId", "sourceType", "occurredAt" DESC);
