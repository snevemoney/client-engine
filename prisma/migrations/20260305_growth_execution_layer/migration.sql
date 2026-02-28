-- Phase 6.3.1: Growth Execution Layer (OutreachEvent + FollowUpSchedule)

-- AlterEnum (OutreachChannel: add sms, call)
ALTER TYPE "OutreachChannel" ADD VALUE 'sms';
ALTER TYPE "OutreachChannel" ADD VALUE 'call';

-- CreateEnum
CREATE TYPE "OutreachEventType" AS ENUM ('sent', 'reply', 'bounced', 'call_booked', 'followup_scheduled');

-- CreateEnum
CREATE TYPE "FollowUpScheduleStatus" AS ENUM ('active', 'paused', 'completed');

-- CreateTable
CREATE TABLE "OutreachEvent" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "channel" "OutreachChannel" NOT NULL,
    "type" "OutreachEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "metaJson" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpSchedule" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "nextFollowUpAt" TIMESTAMP(3) NOT NULL,
    "cadenceDays" INTEGER NOT NULL DEFAULT 3,
    "status" "FollowUpScheduleStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutreachEvent_dealId_idx" ON "OutreachEvent"("dealId");

-- CreateIndex
CREATE INDEX "OutreachEvent_ownerUserId_occurredAt_idx" ON "OutreachEvent"("ownerUserId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "FollowUpSchedule_dealId_idx" ON "FollowUpSchedule"("dealId");

-- CreateIndex
CREATE INDEX "FollowUpSchedule_nextFollowUpAt_status_idx" ON "FollowUpSchedule"("nextFollowUpAt", "status");

-- AddForeignKey
ALTER TABLE "OutreachEvent" ADD CONSTRAINT "OutreachEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpSchedule" ADD CONSTRAINT "FollowUpSchedule_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
