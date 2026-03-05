-- Sprint 5: Payment tracking on Project
-- Sprint 8: Proof fields + Campaign table
-- Sprint 7: Cadence table
-- Sprint 9: Outcome table
-- Sprint 4: SCOPE_SENT, SCOPE_APPROVED on LeadStatus

-- LeadStatus enum (add scope negotiation values if not present)
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'SCOPE_SENT';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'SCOPE_APPROVED';

-- Project: payment + proof fields
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'unpaid';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "paymentAmount" DECIMAL(10,2);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "invoicedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "proofPublishedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "proofHeadline" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "proofSummary" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "proofTestimonial" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "campaignTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Campaign table
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filterTag" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_slug_key" ON "Campaign"("slug");

-- Cadence table
CREATE TABLE IF NOT EXISTS "Cadence" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cadence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Cadence_sourceType_sourceId_idx" ON "Cadence"("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "Cadence_dueAt_idx" ON "Cadence"("dueAt");
CREATE INDEX IF NOT EXISTS "Cadence_trigger_idx" ON "Cadence"("trigger");

-- Outcome table
CREATE TABLE IF NOT EXISTS "Outcome" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actualRevenue" INTEGER,
    "repeatClient" BOOLEAN NOT NULL DEFAULT false,
    "referralSource" TEXT,
    "satisfactionScore" INTEGER,
    "lessonsLearned" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Outcome_projectId_key" ON "Outcome"("projectId");
CREATE INDEX IF NOT EXISTS "Outcome_projectId_idx" ON "Outcome"("projectId");

ALTER TABLE "Outcome" DROP CONSTRAINT IF EXISTS "Outcome_projectId_fkey";
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
