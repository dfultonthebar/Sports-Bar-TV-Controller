-- CreateTable
CREATE TABLE "DirecTVBox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ipAddress" TEXT NOT NULL,
    "macAddress" TEXT,
    "model" TEXT,
    "modelFamily" TEXT,
    "location" TEXT,
    "shefVersion" TEXT,
    "isServer" BOOLEAN NOT NULL DEFAULT false,
    "isClient" BOOLEAN NOT NULL DEFAULT false,
    "serverMacAddress" TEXT,
    "capabilities" TEXT,
    "status" TEXT NOT NULL DEFAULT 'discovered',
    "shefEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" DATETIME,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DirecTVBox_serverMacAddress_fkey" FOREIGN KEY ("serverMacAddress") REFERENCES "DirecTVBox" ("macAddress") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DirecTVChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelNumber" INTEGER NOT NULL,
    "subChannel" INTEGER,
    "channelName" TEXT NOT NULL,
    "callsign" TEXT,
    "network" TEXT,
    "stationId" TEXT,
    "isHD" BOOLEAN NOT NULL DEFAULT false,
    "isOffAir" BOOLEAN NOT NULL DEFAULT false,
    "isPPV" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastVerified" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DirecTVCommand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "model" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "commandCode" TEXT NOT NULL,
    "endpoint" TEXT,
    "parameters" TEXT,
    "description" TEXT,
    "category" TEXT,
    "isDeprecated" BOOLEAN NOT NULL DEFAULT false,
    "minShefVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DirecTVDiscoveryLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discoveryMethod" TEXT NOT NULL,
    "boxesFound" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "ipRange" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "details" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DirecTVGuideRefresh" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boxId" TEXT,
    "channelsUpdated" INTEGER NOT NULL DEFAULT 0,
    "channelsAdded" INTEGER NOT NULL DEFAULT 0,
    "channelsRemoved" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "DirecTVBox_ipAddress_key" ON "DirecTVBox"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "DirecTVBox_macAddress_key" ON "DirecTVBox"("macAddress");

-- CreateIndex
CREATE INDEX "DirecTVBox_status_idx" ON "DirecTVBox"("status");

-- CreateIndex
CREATE INDEX "DirecTVBox_isServer_idx" ON "DirecTVBox"("isServer");

-- CreateIndex
CREATE INDEX "DirecTVBox_model_idx" ON "DirecTVBox"("model");

-- CreateIndex
CREATE INDEX "DirecTVChannel_channelNumber_idx" ON "DirecTVChannel"("channelNumber");

-- CreateIndex
CREATE INDEX "DirecTVChannel_category_idx" ON "DirecTVChannel"("category");

-- CreateIndex
CREATE INDEX "DirecTVChannel_isActive_idx" ON "DirecTVChannel"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DirecTVChannel_channelNumber_subChannel_key" ON "DirecTVChannel"("channelNumber", "subChannel");

-- CreateIndex
CREATE INDEX "DirecTVCommand_model_idx" ON "DirecTVCommand"("model");

-- CreateIndex
CREATE INDEX "DirecTVCommand_commandType_idx" ON "DirecTVCommand"("commandType");

-- CreateIndex
CREATE INDEX "DirecTVCommand_category_idx" ON "DirecTVCommand"("category");

-- CreateIndex
CREATE UNIQUE INDEX "DirecTVCommand_model_commandType_commandName_key" ON "DirecTVCommand"("model", "commandType", "commandName");

-- CreateIndex
CREATE INDEX "DirecTVDiscoveryLog_timestamp_idx" ON "DirecTVDiscoveryLog"("timestamp");

-- CreateIndex
CREATE INDEX "DirecTVDiscoveryLog_status_idx" ON "DirecTVDiscoveryLog"("status");

-- CreateIndex
CREATE INDEX "DirecTVGuideRefresh_startedAt_idx" ON "DirecTVGuideRefresh"("startedAt");

-- CreateIndex
CREATE INDEX "DirecTVGuideRefresh_status_idx" ON "DirecTVGuideRefresh"("status");
