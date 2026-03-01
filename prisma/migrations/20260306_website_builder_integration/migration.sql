-- Website Builder integration fields on DeliveryProject
ALTER TABLE "DeliveryProject" ADD COLUMN "builderSiteId" TEXT;
ALTER TABLE "DeliveryProject" ADD COLUMN "builderPreviewUrl" TEXT;
ALTER TABLE "DeliveryProject" ADD COLUMN "builderLiveUrl" TEXT;
ALTER TABLE "DeliveryProject" ADD COLUMN "builderPreset" TEXT;
