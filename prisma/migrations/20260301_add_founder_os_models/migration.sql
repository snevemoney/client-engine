-- Phase 6.2: Founder Operating System models

-- CreateTable
CREATE TABLE "FounderQuarter" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FounderQuarter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FounderKPI" (
    "id" TEXT NOT NULL,
    "quarterId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT 'count',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FounderKPI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FounderWeek" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "quarterId" TEXT,
    "focusConstraint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FounderWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FounderWeekPlan" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "topOutcomesJson" JSONB NOT NULL DEFAULT '[]',
    "milestonesJson" JSONB NOT NULL DEFAULT '[]',
    "commitmentsJson" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "FounderWeekPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FounderWeekReview" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "winsJson" JSONB NOT NULL DEFAULT '[]',
    "missesJson" JSONB NOT NULL DEFAULT '[]',
    "deltasJson" JSONB NOT NULL DEFAULT '[]',
    "decisionsJson" JSONB NOT NULL DEFAULT '[]',
    "retroNotes" TEXT,

    CONSTRAINT "FounderWeekReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FounderQuarter_startsAt_idx" ON "FounderQuarter"("startsAt");

-- CreateIndex
CREATE INDEX "FounderKPI_quarterId_idx" ON "FounderKPI"("quarterId");

-- CreateIndex
CREATE UNIQUE INDEX "FounderWeek_weekStart_key" ON "FounderWeek"("weekStart");

-- CreateIndex
CREATE INDEX "FounderWeek_weekStart_idx" ON "FounderWeek"("weekStart");

-- CreateIndex
CREATE INDEX "FounderWeek_quarterId_idx" ON "FounderWeek"("quarterId");

-- CreateIndex
CREATE UNIQUE INDEX "FounderWeekPlan_weekId_key" ON "FounderWeekPlan"("weekId");

-- CreateIndex
CREATE INDEX "FounderWeekPlan_weekId_idx" ON "FounderWeekPlan"("weekId");

-- CreateIndex
CREATE UNIQUE INDEX "FounderWeekReview_weekId_key" ON "FounderWeekReview"("weekId");

-- CreateIndex
CREATE INDEX "FounderWeekReview_weekId_idx" ON "FounderWeekReview"("weekId");

-- AddForeignKey
ALTER TABLE "FounderKPI" ADD CONSTRAINT "FounderKPI_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "FounderQuarter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderWeek" ADD CONSTRAINT "FounderWeek_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "FounderQuarter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderWeekPlan" ADD CONSTRAINT "FounderWeekPlan_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "FounderWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderWeekReview" ADD CONSTRAINT "FounderWeekReview_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "FounderWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
