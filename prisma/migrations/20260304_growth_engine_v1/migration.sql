-- Phase 6.3: Growth Engine v1 (Prospecting → Outreach → Follow-up)

-- AlterEnum (OperatorMemorySourceType: add growth)
ALTER TYPE "OperatorMemorySourceType" ADD VALUE 'growth';

-- AlterEnum (RiskSourceType: add growth_pipeline)
ALTER TYPE "RiskSourceType" ADD VALUE 'growth_pipeline';

-- CreateEnum
CREATE TYPE "ProspectPlatform" AS ENUM ('instagram', 'twitter', 'upwork', 'website', 'referral', 'other');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('new', 'contacted', 'replied', 'call_scheduled', 'proposal_sent', 'won', 'lost');

-- CreateEnum
CREATE TYPE "DealPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "OutreachChannel" AS ENUM ('dm', 'email', 'comment', 'other');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('draft', 'sent', 'replied', 'bounced', 'ignored');

-- CreateEnum
CREATE TYPE "DealEventType" AS ENUM ('note', 'call', 'proposal', 'payment', 'status_change');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "platform" "ProspectPlatform" NOT NULL,
    "niche" TEXT,
    "followers" INTEGER,
    "bioUrl" TEXT,
    "currentWebPresence" TEXT,
    "opportunityScore" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'new',
    "valueCad" INTEGER,
    "priority" "DealPriority" NOT NULL DEFAULT 'medium',
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachMessage" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "channel" "OutreachChannel" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "metaJson" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealEvent" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" "DealEventType" NOT NULL,
    "summary" TEXT NOT NULL,
    "metaJson" JSONB DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_handle_key" ON "Prospect"("handle");

-- CreateIndex
CREATE INDEX "Prospect_platform_idx" ON "Prospect"("platform");

-- CreateIndex
CREATE INDEX "Prospect_opportunityScore_idx" ON "Prospect"("opportunityScore");

-- CreateIndex
CREATE INDEX "Deal_stage_nextFollowUpAt_idx" ON "Deal"("stage", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "Deal_ownerUserId_stage_idx" ON "Deal"("ownerUserId", "stage");

-- CreateIndex
CREATE INDEX "Deal_prospectId_idx" ON "Deal"("prospectId");

-- CreateIndex
CREATE INDEX "OutreachMessage_dealId_idx" ON "OutreachMessage"("dealId");

-- CreateIndex
CREATE INDEX "DealEvent_dealId_idx" ON "DealEvent"("dealId");

-- CreateIndex
CREATE INDEX "DealEvent_dealId_occurredAt_idx" ON "DealEvent"("dealId", "occurredAt" DESC);

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealEvent" ADD CONSTRAINT "DealEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
