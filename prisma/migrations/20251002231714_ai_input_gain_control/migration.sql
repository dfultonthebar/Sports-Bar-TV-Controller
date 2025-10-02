-- CreateTable
CREATE TABLE "AIGainConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inputMeterId" TEXT NOT NULL,
    "processorId" TEXT NOT NULL,
    "inputNumber" INTEGER NOT NULL,
    "inputType" TEXT NOT NULL DEFAULT 'line',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "targetLevel" REAL NOT NULL DEFAULT -3.0,
    "fastModeThreshold" REAL NOT NULL DEFAULT -10.0,
    "currentGain" REAL NOT NULL DEFAULT 0.0,
    "adjustmentMode" TEXT NOT NULL DEFAULT 'idle',
    "silenceThreshold" REAL NOT NULL DEFAULT -40.0,
    "silenceDuration" INTEGER NOT NULL DEFAULT 60,
    "lastAudioDetected" DATETIME,
    "fastModeStep" REAL NOT NULL DEFAULT 3.0,
    "slowModeStep" REAL NOT NULL DEFAULT 1.0,
    "adjustmentInterval" INTEGER NOT NULL DEFAULT 500,
    "minGain" REAL NOT NULL DEFAULT -20.0,
    "maxGain" REAL NOT NULL DEFAULT 20.0,
    "lastAdjustment" DATETIME,
    "adjustmentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AIGainConfiguration_inputMeterId_fkey" FOREIGN KEY ("inputMeterId") REFERENCES "AudioInputMeter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIGainAdjustmentLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "processorId" TEXT NOT NULL,
    "inputNumber" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousGain" REAL NOT NULL,
    "newGain" REAL NOT NULL,
    "gainChange" REAL NOT NULL,
    "inputLevel" REAL NOT NULL,
    "targetLevel" REAL NOT NULL,
    "adjustmentMode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    CONSTRAINT "AIGainAdjustmentLog_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AIGainConfiguration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AIGainConfiguration_inputMeterId_key" ON "AIGainConfiguration"("inputMeterId");

-- CreateIndex
CREATE INDEX "AIGainConfiguration_aiEnabled_idx" ON "AIGainConfiguration"("aiEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "AIGainConfiguration_processorId_inputNumber_key" ON "AIGainConfiguration"("processorId", "inputNumber");

-- CreateIndex
CREATE INDEX "AIGainAdjustmentLog_processorId_inputNumber_timestamp_idx" ON "AIGainAdjustmentLog"("processorId", "inputNumber", "timestamp");

-- CreateIndex
CREATE INDEX "AIGainAdjustmentLog_timestamp_idx" ON "AIGainAdjustmentLog"("timestamp");
