
-- CreateTable
CREATE TABLE "ChannelPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "channelNumber" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ChannelPreset_deviceType_order_idx" ON "ChannelPreset"("deviceType", "order");

-- CreateIndex
CREATE INDEX "ChannelPreset_isActive_idx" ON "ChannelPreset"("isActive");
