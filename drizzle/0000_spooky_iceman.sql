CREATE TABLE `AIGainAdjustmentLog` (
	`id` text PRIMARY KEY NOT NULL,
	`configId` text NOT NULL,
	`processorId` text NOT NULL,
	`inputNumber` integer NOT NULL,
	`previousLevel` real NOT NULL,
	`newLevel` real NOT NULL,
	`adjustment` real NOT NULL,
	`reason` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`configId`) REFERENCES `AIGainConfiguration`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `AIGainAdjustmentLog_configId_idx` ON `AIGainAdjustmentLog` (`configId`);--> statement-breakpoint
CREATE INDEX `AIGainAdjustmentLog_timestamp_idx` ON `AIGainAdjustmentLog` (`timestamp`);--> statement-breakpoint
CREATE TABLE `AIGainConfiguration` (
	`id` text PRIMARY KEY NOT NULL,
	`processorId` text NOT NULL,
	`inputNumber` integer NOT NULL,
	`inputName` text NOT NULL,
	`targetLevel` real DEFAULT -20 NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`lastAdjustment` text,
	`adjustmentCount` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AIGainConfiguration_processorId_inputNumber_key` ON `AIGainConfiguration` (`processorId`,`inputNumber`);--> statement-breakpoint
CREATE TABLE `ApiKey` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`keyName` text NOT NULL,
	`apiKey` text NOT NULL,
	`endpoint` text,
	`model` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ApiKey_provider_keyName_key` ON `ApiKey` (`provider`,`keyName`);--> statement-breakpoint
CREATE INDEX `ApiKey_provider_idx` ON `ApiKey` (`provider`);--> statement-breakpoint
CREATE INDEX `ApiKey_isActive_idx` ON `ApiKey` (`isActive`);--> statement-breakpoint
CREATE TABLE `AudioInputMeter` (
	`id` text PRIMARY KEY NOT NULL,
	`processorId` text NOT NULL,
	`inputNumber` integer NOT NULL,
	`inputName` text NOT NULL,
	`level` real DEFAULT 0 NOT NULL,
	`peak` real DEFAULT 0 NOT NULL,
	`clipping` integer DEFAULT false NOT NULL,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AudioInputMeter_processorId_inputNumber_key` ON `AudioInputMeter` (`processorId`,`inputNumber`);--> statement-breakpoint
CREATE INDEX `AudioInputMeter_processorId_timestamp_idx` ON `AudioInputMeter` (`processorId`,`timestamp`);--> statement-breakpoint
CREATE TABLE `AudioMessage` (
	`id` text PRIMARY KEY NOT NULL,
	`processorId` text NOT NULL,
	`name` text NOT NULL,
	`audioFile` text NOT NULL,
	`duration` integer,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `AudioProcessor` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`ipAddress` text NOT NULL,
	`port` integer DEFAULT 80 NOT NULL,
	`tcpPort` integer DEFAULT 5321 NOT NULL,
	`username` text,
	`password` text,
	`zones` integer DEFAULT 4 NOT NULL,
	`description` text,
	`status` text DEFAULT 'offline' NOT NULL,
	`lastSeen` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AudioProcessor_ipAddress_port_key` ON `AudioProcessor` (`ipAddress`,`port`);--> statement-breakpoint
CREATE TABLE `AudioScene` (
	`id` text PRIMARY KEY NOT NULL,
	`processorId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sceneData` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `AudioZone` (
	`id` text PRIMARY KEY NOT NULL,
	`processorId` text NOT NULL,
	`zoneNumber` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`currentSource` text,
	`volume` integer DEFAULT 50 NOT NULL,
	`muted` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AudioZone_processorId_zoneNumber_key` ON `AudioZone` (`processorId`,`zoneNumber`);--> statement-breakpoint
CREATE TABLE `BartenderRemote` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ipAddress` text NOT NULL,
	`port` integer DEFAULT 80 NOT NULL,
	`description` text,
	`status` text DEFAULT 'offline' NOT NULL,
	`lastSeen` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `BartenderRemote_ipAddress_unique` ON `BartenderRemote` (`ipAddress`);--> statement-breakpoint
CREATE TABLE `CECConfiguration` (
	`id` text PRIMARY KEY NOT NULL,
	`isEnabled` integer DEFAULT false NOT NULL,
	`cecInputChannel` integer,
	`usbDevicePath` text DEFAULT '/dev/ttyACM0' NOT NULL,
	`powerOnDelay` integer DEFAULT 2000 NOT NULL,
	`powerOffDelay` integer DEFAULT 1000 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ChannelPreset` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`channelNumber` text NOT NULL,
	`deviceType` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`usageCount` integer DEFAULT 0 NOT NULL,
	`lastUsed` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ChannelPreset_deviceType_order_idx` ON `ChannelPreset` (`deviceType`,`order`);--> statement-breakpoint
CREATE INDEX `ChannelPreset_isActive_idx` ON `ChannelPreset` (`isActive`);--> statement-breakpoint
CREATE INDEX `ChannelPreset_usageCount_idx` ON `ChannelPreset` (`usageCount`);--> statement-breakpoint
CREATE TABLE `ChatSession` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`messages` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `DeviceMapping` (
	`id` text PRIMARY KEY NOT NULL,
	`tvNumber` integer NOT NULL,
	`fireTvDeviceId` text,
	`fireTvName` text,
	`audioZoneId` text,
	`audioZoneName` text,
	`description` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DeviceMapping_tvNumber_unique` ON `DeviceMapping` (`tvNumber`);--> statement-breakpoint
CREATE TABLE `Document` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`originalName` text NOT NULL,
	`filePath` text NOT NULL,
	`fileSize` integer NOT NULL,
	`mimeType` text NOT NULL,
	`content` text,
	`embeddings` text,
	`uploadedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `FireTVDevice` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ipAddress` text NOT NULL,
	`macAddress` text,
	`location` text,
	`status` text DEFAULT 'offline' NOT NULL,
	`lastSeen` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `FireTVDevice_ipAddress_unique` ON `FireTVDevice` (`ipAddress`);--> statement-breakpoint
CREATE TABLE `GlobalCacheDevice` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ipAddress` text NOT NULL,
	`port` integer DEFAULT 4998 NOT NULL,
	`model` text,
	`status` text DEFAULT 'offline' NOT NULL,
	`lastSeen` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `GlobalCacheDevice_ipAddress_unique` ON `GlobalCacheDevice` (`ipAddress`);--> statement-breakpoint
CREATE INDEX `GlobalCacheDevice_status_idx` ON `GlobalCacheDevice` (`status`);--> statement-breakpoint
CREATE INDEX `GlobalCacheDevice_ipAddress_idx` ON `GlobalCacheDevice` (`ipAddress`);--> statement-breakpoint
CREATE TABLE `GlobalCachePort` (
	`id` text PRIMARY KEY NOT NULL,
	`deviceId` text NOT NULL,
	`portNumber` integer NOT NULL,
	`portType` text DEFAULT 'IR' NOT NULL,
	`assignedTo` text,
	`assignedDeviceId` text,
	`irCodeSet` text,
	`enabled` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`deviceId`) REFERENCES `GlobalCacheDevice`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `GlobalCachePort_deviceId_portNumber_key` ON `GlobalCachePort` (`deviceId`,`portNumber`);--> statement-breakpoint
CREATE INDEX `GlobalCachePort_deviceId_idx` ON `GlobalCachePort` (`deviceId`);--> statement-breakpoint
CREATE INDEX `GlobalCachePort_assignedDeviceId_idx` ON `GlobalCachePort` (`assignedDeviceId`);--> statement-breakpoint
CREATE TABLE `HomeTeam` (
	`id` text PRIMARY KEY NOT NULL,
	`teamName` text NOT NULL,
	`sport` text NOT NULL,
	`league` text NOT NULL,
	`category` text NOT NULL,
	`location` text,
	`conference` text,
	`isPrimary` integer DEFAULT false NOT NULL,
	`logoUrl` text,
	`primaryColor` text,
	`secondaryColor` text,
	`isActive` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `HomeTeam_teamName_league_key` ON `HomeTeam` (`teamName`,`league`);--> statement-breakpoint
CREATE TABLE `IndexedFile` (
	`id` text PRIMARY KEY NOT NULL,
	`filePath` text NOT NULL,
	`fileName` text NOT NULL,
	`fileType` text NOT NULL,
	`content` text NOT NULL,
	`fileSize` integer NOT NULL,
	`lastModified` text NOT NULL,
	`lastIndexed` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`hash` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`metadata` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `IndexedFile_filePath_unique` ON `IndexedFile` (`filePath`);--> statement-breakpoint
CREATE INDEX `IndexedFile_isActive_idx` ON `IndexedFile` (`isActive`);--> statement-breakpoint
CREATE INDEX `IndexedFile_fileType_idx` ON `IndexedFile` (`fileType`);--> statement-breakpoint
CREATE INDEX `IndexedFile_lastIndexed_idx` ON `IndexedFile` (`lastIndexed`);--> statement-breakpoint
CREATE TABLE `IRCommand` (
	`id` text PRIMARY KEY NOT NULL,
	`deviceId` text NOT NULL,
	`functionName` text NOT NULL,
	`irCode` text NOT NULL,
	`hexCode` text,
	`codeSetId` text,
	`category` text,
	`description` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`deviceId`) REFERENCES `IRDevice`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `IRCommand_deviceId_functionName_key` ON `IRCommand` (`deviceId`,`functionName`);--> statement-breakpoint
CREATE INDEX `IRCommand_deviceId_idx` ON `IRCommand` (`deviceId`);--> statement-breakpoint
CREATE INDEX `IRCommand_functionName_idx` ON `IRCommand` (`functionName`);--> statement-breakpoint
CREATE INDEX `IRCommand_category_idx` ON `IRCommand` (`category`);--> statement-breakpoint
CREATE TABLE `IRDatabaseCredentials` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`apiKey` text,
	`isActive` integer DEFAULT true NOT NULL,
	`lastLogin` text,
	`dailyLimit` integer DEFAULT 50 NOT NULL,
	`usedToday` integer DEFAULT 0 NOT NULL,
	`lastReset` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `IRDatabaseCredentials_email_unique` ON `IRDatabaseCredentials` (`email`);--> statement-breakpoint
CREATE INDEX `IRDatabaseCredentials_isActive_idx` ON `IRDatabaseCredentials` (`isActive`);--> statement-breakpoint
CREATE TABLE `IRDevice` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`deviceType` text NOT NULL,
	`brand` text NOT NULL,
	`model` text,
	`matrixInput` integer,
	`matrixInputLabel` text,
	`irCodeSetId` text,
	`globalCacheDeviceId` text,
	`globalCachePortNumber` integer,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `IRDevice_deviceType_idx` ON `IRDevice` (`deviceType`);--> statement-breakpoint
CREATE INDEX `IRDevice_brand_idx` ON `IRDevice` (`brand`);--> statement-breakpoint
CREATE INDEX `IRDevice_matrixInput_idx` ON `IRDevice` (`matrixInput`);--> statement-breakpoint
CREATE INDEX `IRDevice_globalCacheDeviceId_idx` ON `IRDevice` (`globalCacheDeviceId`);--> statement-breakpoint
CREATE TABLE `MatrixConfig` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`config` text NOT NULL,
	`isActive` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `MatrixConfiguration` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ipAddress` text NOT NULL,
	`tcpPort` integer DEFAULT 23 NOT NULL,
	`udpPort` integer DEFAULT 4000 NOT NULL,
	`protocol` text DEFAULT 'TCP' NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`cecInputChannel` integer,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `MatrixInput` (
	`id` text PRIMARY KEY NOT NULL,
	`configId` text NOT NULL,
	`channelNumber` integer NOT NULL,
	`label` text NOT NULL,
	`inputType` text DEFAULT 'HDMI' NOT NULL,
	`deviceType` text DEFAULT 'Other' NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`powerOn` integer DEFAULT false NOT NULL,
	`isCecPort` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`configId`) REFERENCES `MatrixConfiguration`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `MatrixInput_configId_channelNumber_key` ON `MatrixInput` (`configId`,`channelNumber`);--> statement-breakpoint
CREATE TABLE `MatrixOutput` (
	`id` text PRIMARY KEY NOT NULL,
	`configId` text NOT NULL,
	`channelNumber` integer NOT NULL,
	`label` text NOT NULL,
	`resolution` text DEFAULT '1080p' NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`audioOutput` text,
	`powerOn` integer DEFAULT false NOT NULL,
	`selectedVideoInput` integer,
	`videoInputLabel` text,
	`dailyTurnOn` integer DEFAULT false NOT NULL,
	`dailyTurnOff` integer DEFAULT false NOT NULL,
	`tvBrand` text,
	`tvModel` text,
	`cecAddress` text,
	`lastDiscovery` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`configId`) REFERENCES `MatrixConfiguration`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `MatrixOutput_configId_channelNumber_key` ON `MatrixOutput` (`configId`,`channelNumber`);--> statement-breakpoint
CREATE TABLE `MatrixRoute` (
	`id` text PRIMARY KEY NOT NULL,
	`inputNum` integer NOT NULL,
	`outputNum` integer NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `MatrixRoute_outputNum_unique` ON `MatrixRoute` (`outputNum`);--> statement-breakpoint
CREATE INDEX `MatrixRoute_outputNum_idx` ON `MatrixRoute` (`outputNum`);--> statement-breakpoint
CREATE TABLE `ProcessedFile` (
	`id` text PRIMARY KEY NOT NULL,
	`filePath` text NOT NULL,
	`fileHash` text NOT NULL,
	`lastProcessed` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`qaCount` integer DEFAULT 0 NOT NULL,
	`sourceType` text NOT NULL,
	`status` text DEFAULT 'processed' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ProcessedFile_filePath_unique` ON `ProcessedFile` (`filePath`);--> statement-breakpoint
CREATE INDEX `ProcessedFile_status_idx` ON `ProcessedFile` (`status`);--> statement-breakpoint
CREATE INDEX `ProcessedFile_sourceType_idx` ON `ProcessedFile` (`sourceType`);--> statement-breakpoint
CREATE INDEX `ProcessedFile_lastProcessed_idx` ON `ProcessedFile` (`lastProcessed`);--> statement-breakpoint
CREATE TABLE `ProviderInput` (
	`id` text PRIMARY KEY NOT NULL,
	`providerId` text NOT NULL,
	`inputId` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`providerId`) REFERENCES `TVProvider`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ProviderInput_providerId_inputId_key` ON `ProviderInput` (`providerId`,`inputId`);--> statement-breakpoint
CREATE TABLE `QAEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`tags` text,
	`sourceFile` text,
	`sourceType` text DEFAULT 'manual' NOT NULL,
	`confidence` real DEFAULT 1 NOT NULL,
	`useCount` integer DEFAULT 0 NOT NULL,
	`lastUsed` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `QAEntry_category_idx` ON `QAEntry` (`category`);--> statement-breakpoint
CREATE INDEX `QAEntry_isActive_idx` ON `QAEntry` (`isActive`);--> statement-breakpoint
CREATE INDEX `QAEntry_sourceType_idx` ON `QAEntry` (`sourceType`);--> statement-breakpoint
CREATE INDEX `QAEntry_sourceFile_idx` ON `QAEntry` (`sourceFile`);--> statement-breakpoint
CREATE TABLE `QAGenerationJob` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sourceType` text NOT NULL,
	`sourcePath` text,
	`totalFiles` integer DEFAULT 0 NOT NULL,
	`processedFiles` integer DEFAULT 0 NOT NULL,
	`generatedQAs` integer DEFAULT 0 NOT NULL,
	`entriesGenerated` integer DEFAULT 0 NOT NULL,
	`errorMessage` text,
	`startedAt` text,
	`completedAt` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `QAGenerationJob_status_idx` ON `QAGenerationJob` (`status`);--> statement-breakpoint
CREATE INDEX `QAGenerationJob_createdAt_idx` ON `QAGenerationJob` (`createdAt`);--> statement-breakpoint
CREATE TABLE `ScheduleLog` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduleId` text NOT NULL,
	`executedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`success` integer NOT NULL,
	`error` text,
	`channelName` text NOT NULL,
	`deviceName` text NOT NULL,
	FOREIGN KEY (`scheduleId`) REFERENCES `Schedule`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`deviceId` text NOT NULL,
	`channelName` text NOT NULL,
	`channelNumber` text,
	`startTime` text NOT NULL,
	`endTime` text,
	`recurring` integer DEFAULT false NOT NULL,
	`daysOfWeek` text,
	`enabled` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`deviceId`) REFERENCES `FireTVDevice`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `SelectedLeague` (
	`id` text PRIMARY KEY NOT NULL,
	`league` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SelectedLeague_league_unique` ON `SelectedLeague` (`league`);--> statement-breakpoint
CREATE INDEX `SelectedLeague_league_idx` ON `SelectedLeague` (`league`);--> statement-breakpoint
CREATE INDEX `SelectedLeague_priority_idx` ON `SelectedLeague` (`priority`);--> statement-breakpoint
CREATE TABLE `SoundtrackConfig` (
	`id` text PRIMARY KEY NOT NULL,
	`apiKey` text NOT NULL,
	`accountId` text,
	`accountName` text,
	`isActive` integer DEFAULT true NOT NULL,
	`lastSync` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `SoundtrackPlayer` (
	`id` text PRIMARY KEY NOT NULL,
	`configId` text NOT NULL,
	`playerId` text NOT NULL,
	`playerName` text NOT NULL,
	`locationName` text,
	`audioZoneId` text,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`configId`) REFERENCES `SoundtrackConfig`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audioZoneId`) REFERENCES `AudioZone`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `SoundtrackPlayer_configId_idx` ON `SoundtrackPlayer` (`configId`);--> statement-breakpoint
CREATE UNIQUE INDEX `SoundtrackPlayer_playerId_key` ON `SoundtrackPlayer` (`playerId`);--> statement-breakpoint
CREATE TABLE `SportsGuideConfiguration` (
	`id` text PRIMARY KEY NOT NULL,
	`zipCode` text,
	`city` text,
	`state` text,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `SystemSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SystemSettings_key_unique` ON `SystemSettings` (`key`);--> statement-breakpoint
CREATE TABLE `TestLog` (
	`id` text PRIMARY KEY NOT NULL,
	`testType` text NOT NULL,
	`testName` text NOT NULL,
	`status` text NOT NULL,
	`inputChannel` integer,
	`outputChannel` integer,
	`command` text,
	`response` text,
	`errorMessage` text,
	`duration` integer,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `TestLog_testType_idx` ON `TestLog` (`testType`);--> statement-breakpoint
CREATE INDEX `TestLog_status_idx` ON `TestLog` (`status`);--> statement-breakpoint
CREATE INDEX `TestLog_timestamp_idx` ON `TestLog` (`timestamp`);--> statement-breakpoint
CREATE TABLE `TodoDocument` (
	`id` text PRIMARY KEY NOT NULL,
	`todoId` text NOT NULL,
	`filename` text NOT NULL,
	`filepath` text NOT NULL,
	`filesize` integer,
	`mimetype` text,
	`uploadedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`todoId`) REFERENCES `Todo`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TodoDocument_todoId_idx` ON `TodoDocument` (`todoId`);--> statement-breakpoint
CREATE TABLE `Todo` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`category` text,
	`tags` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completedAt` text
);
--> statement-breakpoint
CREATE TABLE `TrainingDocument` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`fileType` text NOT NULL,
	`fileName` text NOT NULL,
	`fileSize` integer NOT NULL,
	`category` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `TrainingDocument_fileType_idx` ON `TrainingDocument` (`fileType`);--> statement-breakpoint
CREATE INDEX `TrainingDocument_isActive_idx` ON `TrainingDocument` (`isActive`);--> statement-breakpoint
CREATE TABLE `TVLayout` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`layoutData` text NOT NULL,
	`isActive` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `TVProvider` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`channels` text NOT NULL,
	`packages` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `WolfpackMatrixRouting` (
	`id` text PRIMARY KEY NOT NULL,
	`matrixOutputNumber` integer NOT NULL,
	`wolfpackInputNumber` integer NOT NULL,
	`wolfpackInputLabel` text NOT NULL,
	`atlasInputLabel` text,
	`isActive` integer DEFAULT true NOT NULL,
	`lastRouted` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `WolfpackMatrixRouting_matrixOutputNumber_unique` ON `WolfpackMatrixRouting` (`matrixOutputNumber`);--> statement-breakpoint
CREATE TABLE `WolfpackMatrixState` (
	`id` text PRIMARY KEY NOT NULL,
	`matrixOutputNumber` integer NOT NULL,
	`wolfpackInputNumber` integer NOT NULL,
	`wolfpackInputLabel` text NOT NULL,
	`channelInfo` text,
	`routedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `WolfpackMatrixState_matrixOutputNumber_idx` ON `WolfpackMatrixState` (`matrixOutputNumber`);--> statement-breakpoint
CREATE INDEX `WolfpackMatrixState_routedAt_idx` ON `WolfpackMatrixState` (`routedAt`);