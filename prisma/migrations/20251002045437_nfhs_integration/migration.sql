-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "content" TEXT,
    "embeddings" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "keyValue" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "messages" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MatrixConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 4999,
    "tcpPort" INTEGER NOT NULL DEFAULT 5000,
    "udpPort" INTEGER NOT NULL DEFAULT 4000,
    "protocol" TEXT NOT NULL DEFAULT 'TCP',
    "connectionStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "lastTested" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cecInputChannel" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MatrixInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "channelNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "inputType" TEXT NOT NULL DEFAULT 'HDMI',
    "deviceType" TEXT NOT NULL DEFAULT 'Other',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatrixInput_configId_fkey" FOREIGN KEY ("configId") REFERENCES "MatrixConfiguration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatrixOutput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "channelNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "resolution" TEXT NOT NULL DEFAULT '1080p',
    "status" TEXT NOT NULL DEFAULT 'active',
    "audioOutput" TEXT,
    "tvBrand" TEXT,
    "tvModel" TEXT,
    "cecAddress" TEXT,
    "lastDiscovery" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dailyTurnOn" BOOLEAN NOT NULL DEFAULT false,
    "dailyTurnOff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatrixOutput_configId_fkey" FOREIGN KEY ("configId") REFERENCES "MatrixConfiguration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatrixRoute" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inputNum" INTEGER NOT NULL,
    "outputNum" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MatrixScene" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sceneNum" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "routes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AudioProcessor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 80,
    "zones" INTEGER NOT NULL DEFAULT 4,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastSeen" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AudioZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processorId" TEXT NOT NULL,
    "zoneNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currentSource" TEXT,
    "volume" INTEGER NOT NULL DEFAULT 50,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AudioZone_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "AudioProcessor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioScene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processorId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "settings" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AudioScene_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "AudioProcessor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processorId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT,
    "duration" INTEGER,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AudioMessage_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "AudioProcessor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioInputMeter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processorId" TEXT NOT NULL,
    "inputNumber" INTEGER NOT NULL,
    "parameterName" TEXT NOT NULL,
    "inputName" TEXT,
    "currentLevel" REAL,
    "peakLevel" REAL,
    "levelPercent" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdate" DATETIME,
    "warningThreshold" REAL NOT NULL DEFAULT -12.0,
    "dangerThreshold" REAL NOT NULL DEFAULT -3.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AudioInputMeter_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "AudioProcessor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CECConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cecInputChannel" INTEGER,
    "cecServerIP" TEXT NOT NULL DEFAULT '192.168.1.100',
    "cecPort" INTEGER NOT NULL DEFAULT 8080,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "powerOnDelay" INTEGER NOT NULL DEFAULT 2000,
    "powerOffDelay" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SportsGuideConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zipCode" TEXT,
    "city" TEXT,
    "state" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TVProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channels" TEXT NOT NULL,
    "packages" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProviderInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderInput_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "TVProvider" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProviderInput_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "MatrixInput" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HomeTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamName" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "location" TEXT,
    "conference" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SoundtrackConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiKey" TEXT NOT NULL,
    "accountId" TEXT,
    "accountName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastTested" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SoundtrackPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "accountId" TEXT,
    "bartenderVisible" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SoundtrackPlayer_configId_fkey" FOREIGN KEY ("configId") REFERENCES "SoundtrackConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduleType" TEXT NOT NULL DEFAULT 'daily',
    "executionTime" TEXT,
    "daysOfWeek" TEXT,
    "powerOnTVs" BOOLEAN NOT NULL DEFAULT true,
    "powerOffTVs" BOOLEAN NOT NULL DEFAULT false,
    "selectedOutputs" TEXT NOT NULL,
    "setDefaultChannels" BOOLEAN NOT NULL DEFAULT false,
    "defaultChannelMap" TEXT,
    "autoFindGames" BOOLEAN NOT NULL DEFAULT false,
    "monitorHomeTeams" BOOLEAN NOT NULL DEFAULT false,
    "homeTeamIds" TEXT,
    "preferredProviders" TEXT,
    "executionOrder" TEXT NOT NULL DEFAULT 'outputs_first',
    "delayBetweenCommands" INTEGER NOT NULL DEFAULT 2000,
    "lastExecuted" DATETIME,
    "nextExecution" DATETIME,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastResult" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScheduleLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "scheduleName" TEXT NOT NULL,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "message" TEXT,
    "details" TEXT,
    "gamesFound" INTEGER NOT NULL DEFAULT 0,
    "tvsControlled" INTEGER NOT NULL DEFAULT 0,
    "channelsSet" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT
);

-- CreateTable
CREATE TABLE "SelectedLeague" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IndexedFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "lastModified" DATETIME NOT NULL,
    "lastIndexed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NFHSSchool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nfhsId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT,
    "conferences" TEXT,
    "sports" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NFHSGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nfhsEventId" TEXT,
    "homeSchoolId" TEXT NOT NULL,
    "awaySchoolId" TEXT NOT NULL,
    "homeTeamName" TEXT NOT NULL,
    "awayTeamName" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "league" TEXT,
    "division" TEXT,
    "level" TEXT,
    "gender" TEXT,
    "gameDate" DATETIME NOT NULL,
    "gameTime" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "isNFHSNetwork" BOOLEAN NOT NULL DEFAULT false,
    "streamUrl" TEXT,
    "streamStatus" TEXT,
    "ticketInfo" TEXT,
    "notes" TEXT,
    "lastSynced" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NFHSGame_homeSchoolId_fkey" FOREIGN KEY ("homeSchoolId") REFERENCES "NFHSSchool" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NFHSGame_awaySchoolId_fkey" FOREIGN KEY ("awaySchoolId") REFERENCES "NFHSSchool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MatrixInput_configId_channelNumber_key" ON "MatrixInput"("configId", "channelNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MatrixOutput_configId_channelNumber_key" ON "MatrixOutput"("configId", "channelNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AudioProcessor_ipAddress_port_key" ON "AudioProcessor"("ipAddress", "port");

-- CreateIndex
CREATE UNIQUE INDEX "AudioZone_processorId_zoneNumber_key" ON "AudioZone"("processorId", "zoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AudioScene_processorId_sceneNumber_key" ON "AudioScene"("processorId", "sceneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AudioMessage_processorId_messageId_key" ON "AudioMessage"("processorId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "AudioInputMeter_processorId_inputNumber_key" ON "AudioInputMeter"("processorId", "inputNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderInput_providerId_inputId_key" ON "ProviderInput"("providerId", "inputId");

-- CreateIndex
CREATE UNIQUE INDEX "SoundtrackPlayer_configId_playerId_key" ON "SoundtrackPlayer"("configId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "SelectedLeague_leagueId_key" ON "SelectedLeague"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "IndexedFile_filePath_key" ON "IndexedFile"("filePath");

-- CreateIndex
CREATE INDEX "IndexedFile_fileType_idx" ON "IndexedFile"("fileType");

-- CreateIndex
CREATE INDEX "IndexedFile_lastIndexed_idx" ON "IndexedFile"("lastIndexed");

-- CreateIndex
CREATE UNIQUE INDEX "NFHSSchool_nfhsId_key" ON "NFHSSchool"("nfhsId");

-- CreateIndex
CREATE INDEX "NFHSSchool_state_city_idx" ON "NFHSSchool"("state", "city");

-- CreateIndex
CREATE UNIQUE INDEX "NFHSGame_nfhsEventId_key" ON "NFHSGame"("nfhsEventId");

-- CreateIndex
CREATE INDEX "NFHSGame_gameDate_sport_idx" ON "NFHSGame"("gameDate", "sport");

-- CreateIndex
CREATE INDEX "NFHSGame_homeSchoolId_idx" ON "NFHSGame"("homeSchoolId");

-- CreateIndex
CREATE INDEX "NFHSGame_awaySchoolId_idx" ON "NFHSGame"("awaySchoolId");

-- CreateIndex
CREATE INDEX "NFHSGame_status_idx" ON "NFHSGame"("status");
