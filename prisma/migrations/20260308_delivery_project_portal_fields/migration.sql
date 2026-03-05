-- Sprint 6: Client portal — clientToken, builder health fields on DeliveryProject
ALTER TABLE "DeliveryProject" ADD COLUMN IF NOT EXISTS "clientToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryProject_clientToken_key" ON "DeliveryProject"("clientToken");
ALTER TABLE "DeliveryProject" ADD COLUMN IF NOT EXISTS "builderHealthScore" INTEGER;
ALTER TABLE "DeliveryProject" ADD COLUMN IF NOT EXISTS "builderHealthLabel" TEXT;
ALTER TABLE "DeliveryProject" ADD COLUMN IF NOT EXISTS "builderHealthCheckedAt" TIMESTAMP(3);
