-- Phase 7.1: Operator Memory (Pattern Learning v1)

-- CreateEnum
CREATE TYPE "OperatorMemorySourceType" AS ENUM ('nba_execute', 'nba_dismiss', 'nba_snooze', 'copilot_action', 'risk_resolve', 'founder_review');

-- CreateEnum
CREATE TYPE "OperatorMemoryOutcome" AS ENUM ('success', 'failure', 'neutral');

-- CreateEnum
CREATE TYPE "OperatorLearnedWeightKind" AS ENUM ('rule', 'action');

-- CreateTable
CREATE TABLE "OperatorMemoryEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "sourceType" "OperatorMemorySourceType" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "ruleKey" TEXT,
    "actionKey" TEXT,
    "outcome" "OperatorMemoryOutcome" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metaJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "OperatorMemoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorLearnedWeight" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "kind" "OperatorLearnedWeightKind" NOT NULL,
    "key" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statsJson" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorLearnedWeight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperatorMemoryEvent_actorUserId_createdAt_idx" ON "OperatorMemoryEvent"("actorUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OperatorMemoryEvent_actorUserId_ruleKey_createdAt_idx" ON "OperatorMemoryEvent"("actorUserId", "ruleKey", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OperatorMemoryEvent_actorUserId_actionKey_createdAt_idx" ON "OperatorMemoryEvent"("actorUserId", "actionKey", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "OperatorLearnedWeight_actorUserId_kind_key_key" ON "OperatorLearnedWeight"("actorUserId", "kind", "key");

-- CreateIndex
CREATE INDEX "OperatorLearnedWeight_actorUserId_idx" ON "OperatorLearnedWeight"("actorUserId");
