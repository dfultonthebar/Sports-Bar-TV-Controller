
-- CreateTable
CREATE TABLE "FireCubeDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 5555,
    "macAddress" TEXT,
    "serialNumber" TEXT,
    "deviceModel" TEXT,
    "softwareVersion" TEXT,
    "location" TEXT,
    "matrixInputChannel" INTEGER,
    "adbEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'discovered',
    "lastSeen" DATETIME,
    "keepAwakeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "keepAwakeStart" TEXT DEFAULT '07:00',
    "keepAwakeEnd" TEXT DEFAULT '01:00',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FireCubeApp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "version" TEXT,
    "versionCode" INTEGER,
    "category" TEXT,
    "iconUrl" TEXT,
    "isSystemApp" BOOLEAN NOT NULL DEFAULT false,
    "isSportsApp" BOOLEAN NOT NULL DEFAULT false,
    "hasSubscription" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionStatus" TEXT,
    "lastChecked" DATETIME,
    "installedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FireCubeApp_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "FireCubeDevice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FireCubeSportsContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "contentTitle" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "league" TEXT,
    "teams" TEXT,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "channel" TEXT,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "deepLink" TEXT,
    "thumbnailUrl" TEXT,
    "description" TEXT,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FireCubeSportsContent_appId_fkey" FOREIGN KEY ("appId") REFERENCES "FireCubeApp" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FireCubeSportsContent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "FireCubeDevice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FireCubeKeepAwakeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FireCubeKeepAwakeLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "FireCubeDevice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FireCubeSideloadOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceDeviceId" TEXT NOT NULL,
    "targetDeviceIds" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalDevices" INTEGER NOT NULL,
    "completedDevices" INTEGER NOT NULL DEFAULT 0,
    "failedDevices" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "FireCubeSideloadOperation_sourceDeviceId_fkey" FOREIGN KEY ("sourceDeviceId") REFERENCES "FireCubeDevice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FireCubeDiscoveryLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discoveryMethod" TEXT NOT NULL,
    "devicesFound" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "ipRange" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "details" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "FireCubeDevice_ipAddress_key" ON "FireCubeDevice"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "FireCubeDevice_serialNumber_key" ON "FireCubeDevice"("serialNumber");

-- CreateIndex
CREATE INDEX "FireCubeDevice_status_idx" ON "FireCubeDevice"("status");

-- CreateIndex
CREATE INDEX "FireCubeDevice_keepAwakeEnabled_idx" ON "FireCubeDevice"("keepAwakeEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "FireCubeApp_deviceId_packageName_key" ON "FireCubeApp"("deviceId", "packageName");

-- CreateIndex
CREATE INDEX "FireCubeApp_deviceId_idx" ON "FireCubeApp"("deviceId");

-- CreateIndex
CREATE INDEX "FireCubeApp_isSportsApp_idx" ON "FireCubeApp"("isSportsApp");

-- CreateIndex
CREATE INDEX "FireCubeApp_hasSubscription_idx" ON "FireCubeApp"("hasSubscription");

-- CreateIndex
CREATE INDEX "FireCubeSportsContent_deviceId_idx" ON "FireCubeSportsContent"("deviceId");

-- CreateIndex
CREATE INDEX "FireCubeSportsContent_isLive_idx" ON "FireCubeSportsContent"("isLive");

-- CreateIndex
CREATE INDEX "FireCubeSportsContent_startTime_idx" ON "FireCubeSportsContent"("startTime");

-- CreateIndex
CREATE INDEX "FireCubeKeepAwakeLog_deviceId_idx" ON "FireCubeKeepAwakeLog"("deviceId");

-- CreateIndex
CREATE INDEX "FireCubeKeepAwakeLog_timestamp_idx" ON "FireCubeKeepAwakeLog"("timestamp");

-- CreateIndex
CREATE INDEX "FireCubeSideloadOperation_status_idx" ON "FireCubeSideloadOperation"("status");

-- CreateIndex
CREATE INDEX "FireCubeSideloadOperation_startedAt_idx" ON "FireCubeSideloadOperation"("startedAt");

-- CreateIndex
CREATE INDEX "FireCubeDiscoveryLog_timestamp_idx" ON "FireCubeDiscoveryLog"("timestamp");

-- CreateIndex
CREATE INDEX "FireCubeDiscoveryLog_status_idx" ON "FireCubeDiscoveryLog"("status");
