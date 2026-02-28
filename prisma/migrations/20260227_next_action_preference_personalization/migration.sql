-- CreateTable
CREATE TABLE "NextActionPreference" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ruleKey" TEXT,
    "dedupeKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "suppressedUntil" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NextActionPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NextActionPreference_entityType_entityId_idx" ON "NextActionPreference"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "NextActionPreference_ruleKey_idx" ON "NextActionPreference"("ruleKey");

-- CreateIndex
CREATE INDEX "NextActionPreference_dedupeKey_idx" ON "NextActionPreference"("dedupeKey");
