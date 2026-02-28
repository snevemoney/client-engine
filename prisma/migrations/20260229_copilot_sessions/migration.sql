-- CreateTable
CREATE TABLE "CopilotSession" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "entityType" TEXT NOT NULL DEFAULT 'command_center',
    "entityId" TEXT NOT NULL DEFAULT 'command_center',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopilotSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL DEFAULT '{}',
    "sourcesJson" JSONB,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotActionLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "nextActionId" TEXT,
    "nbaActionKey" TEXT,
    "beforeJson" JSONB DEFAULT '{}',
    "afterJson" JSONB DEFAULT '{}',
    "resultJson" JSONB DEFAULT '{}',
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CopilotSession_status_idx" ON "CopilotSession"("status");

-- CreateIndex
CREATE INDEX "CopilotSession_createdAt_idx" ON "CopilotSession"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "CopilotMessage_sessionId_idx" ON "CopilotMessage"("sessionId");

-- CreateIndex
CREATE INDEX "CopilotMessage_sessionId_createdAt_idx" ON "CopilotMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "CopilotActionLog_sessionId_idx" ON "CopilotActionLog"("sessionId");

-- CreateIndex
CREATE INDEX "CopilotActionLog_sessionId_createdAt_idx" ON "CopilotActionLog"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "CopilotMessage" ADD CONSTRAINT "CopilotMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CopilotSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotActionLog" ADD CONSTRAINT "CopilotActionLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CopilotSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
