CREATE TABLE `AudioGroup` (
	`id` text PRIMARY KEY NOT NULL,
	`processorId` text NOT NULL,
	`groupNumber` integer NOT NULL,
	`name` text NOT NULL,
	`isActive` integer DEFAULT false NOT NULL,
	`currentSource` text,
	`gain` real DEFAULT -10 NOT NULL,
	`muted` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AudioGroup_processorId_groupNumber_key` ON `AudioGroup` (`processorId`,`groupNumber`);--> statement-breakpoint
CREATE TABLE `AuditLog` (
	`id` text PRIMARY KEY NOT NULL,
	`locationId` text NOT NULL,
	`sessionId` text,
	`apiKeyId` text,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`resourceId` text,
	`endpoint` text NOT NULL,
	`method` text NOT NULL,
	`ipAddress` text NOT NULL,
	`userAgent` text,
	`requestData` text,
	`responseStatus` integer,
	`success` integer NOT NULL,
	`errorMessage` text,
	`metadata` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`apiKeyId`) REFERENCES `AuthApiKey`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `AuditLog_locationId_idx` ON `AuditLog` (`locationId`);--> statement-breakpoint
CREATE INDEX `AuditLog_sessionId_idx` ON `AuditLog` (`sessionId`);--> statement-breakpoint
CREATE INDEX `AuditLog_apiKeyId_idx` ON `AuditLog` (`apiKeyId`);--> statement-breakpoint
CREATE INDEX `AuditLog_action_idx` ON `AuditLog` (`action`);--> statement-breakpoint
CREATE INDEX `AuditLog_resource_idx` ON `AuditLog` (`resource`);--> statement-breakpoint
CREATE INDEX `AuditLog_timestamp_idx` ON `AuditLog` (`timestamp`);--> statement-breakpoint
CREATE INDEX `AuditLog_success_idx` ON `AuditLog` (`success`);--> statement-breakpoint
CREATE TABLE `AuthApiKey` (
	`id` text PRIMARY KEY NOT NULL,
	`locationId` text NOT NULL,
	`name` text NOT NULL,
	`keyHash` text NOT NULL,
	`permissions` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`expiresAt` text,
	`lastUsed` text,
	`usageCount` integer DEFAULT 0 NOT NULL,
	`createdBy` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `AuthApiKey_locationId_idx` ON `AuthApiKey` (`locationId`);--> statement-breakpoint
CREATE INDEX `AuthApiKey_isActive_idx` ON `AuthApiKey` (`isActive`);--> statement-breakpoint
CREATE INDEX `AuthApiKey_lastUsed_idx` ON `AuthApiKey` (`lastUsed`);--> statement-breakpoint
CREATE TABLE `AuthPin` (
	`id` text PRIMARY KEY NOT NULL,
	`locationId` text NOT NULL,
	`role` text NOT NULL,
	`pinHash` text NOT NULL,
	`description` text,
	`isActive` integer DEFAULT true NOT NULL,
	`expiresAt` text,
	`createdBy` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `AuthPin_locationId_idx` ON `AuthPin` (`locationId`);--> statement-breakpoint
CREATE INDEX `AuthPin_role_idx` ON `AuthPin` (`role`);--> statement-breakpoint
CREATE INDEX `AuthPin_isActive_idx` ON `AuthPin` (`isActive`);--> statement-breakpoint
CREATE TABLE `CableBox` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cecDeviceId` text NOT NULL,
	`matrixInputId` text,
	`provider` text DEFAULT 'spectrum' NOT NULL,
	`model` text DEFAULT 'spectrum-100h' NOT NULL,
	`lastChannel` text,
	`isOnline` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cecDeviceId`) REFERENCES `CECDevice`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CableBox_cecDeviceId_key` ON `CableBox` (`cecDeviceId`);--> statement-breakpoint
CREATE INDEX `CableBox_matrixInputId_idx` ON `CableBox` (`matrixInputId`);--> statement-breakpoint
CREATE TABLE `CECCommandLog` (
	`id` text PRIMARY KEY NOT NULL,
	`cecDeviceId` text NOT NULL,
	`command` text NOT NULL,
	`cecCode` text,
	`params` text,
	`success` integer NOT NULL,
	`responseTime` integer,
	`errorMessage` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cecDeviceId`) REFERENCES `CECDevice`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CECCommandLog_cecDeviceId_idx` ON `CECCommandLog` (`cecDeviceId`);--> statement-breakpoint
CREATE INDEX `CECCommandLog_timestamp_idx` ON `CECCommandLog` (`timestamp`);--> statement-breakpoint
CREATE INDEX `CECCommandLog_command_idx` ON `CECCommandLog` (`command`);--> statement-breakpoint
CREATE TABLE `CECDevice` (
	`id` text PRIMARY KEY NOT NULL,
	`devicePath` text NOT NULL,
	`deviceType` text DEFAULT 'cable_box' NOT NULL,
	`deviceName` text NOT NULL,
	`matrixInputId` text,
	`cecAddress` text,
	`vendorId` text,
	`productId` text,
	`serialNumber` text,
	`firmwareVersion` text,
	`isActive` integer DEFAULT true NOT NULL,
	`lastSeen` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `CECDevice_devicePath_unique` ON `CECDevice` (`devicePath`);--> statement-breakpoint
CREATE INDEX `CECDevice_devicePath_idx` ON `CECDevice` (`devicePath`);--> statement-breakpoint
CREATE INDEX `CECDevice_deviceType_idx` ON `CECDevice` (`deviceType`);--> statement-breakpoint
CREATE INDEX `CECDevice_isActive_idx` ON `CECDevice` (`isActive`);--> statement-breakpoint
CREATE TABLE `FireCubeApp` (
	`id` text PRIMARY KEY NOT NULL,
	`deviceId` text NOT NULL,
	`packageName` text NOT NULL,
	`appName` text NOT NULL,
	`version` text,
	`versionCode` integer,
	`category` text,
	`iconUrl` text,
	`isSystemApp` integer DEFAULT false NOT NULL,
	`isSportsApp` integer DEFAULT false NOT NULL,
	`hasSubscription` integer DEFAULT false NOT NULL,
	`subscriptionStatus` text,
	`lastChecked` text,
	`installedAt` text,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`deviceId`) REFERENCES `FireCubeDevice`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `FireCubeApp_deviceId_packageName_key` ON `FireCubeApp` (`deviceId`,`packageName`);--> statement-breakpoint
CREATE INDEX `FireCubeApp_deviceId_idx` ON `FireCubeApp` (`deviceId`);--> statement-breakpoint
CREATE TABLE `FireCubeDevice` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ipAddress` text NOT NULL,
	`port` integer DEFAULT 5555 NOT NULL,
	`macAddress` text,
	`serialNumber` text,
	`deviceModel` text,
	`softwareVersion` text,
	`location` text,
	`matrixInputChannel` integer,
	`adbEnabled` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'discovered' NOT NULL,
	`lastSeen` text,
	`keepAwakeEnabled` integer DEFAULT false NOT NULL,
	`keepAwakeStart` text DEFAULT '07:00',
	`keepAwakeEnd` text DEFAULT '01:00',
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `FireCubeDevice_ipAddress_unique` ON `FireCubeDevice` (`ipAddress`);--> statement-breakpoint
CREATE UNIQUE INDEX `FireCubeDevice_serialNumber_unique` ON `FireCubeDevice` (`serialNumber`);--> statement-breakpoint
CREATE TABLE `FireCubeKeepAwakeLog` (
	`id` text PRIMARY KEY NOT NULL,
	`deviceId` text NOT NULL,
	`action` text NOT NULL,
	`success` integer NOT NULL,
	`errorMessage` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`deviceId`) REFERENCES `FireCubeDevice`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `FireCubeKeepAwakeLog_deviceId_idx` ON `FireCubeKeepAwakeLog` (`deviceId`);--> statement-breakpoint
CREATE INDEX `FireCubeKeepAwakeLog_timestamp_idx` ON `FireCubeKeepAwakeLog` (`timestamp`);--> statement-breakpoint
CREATE TABLE `FireCubeSideloadOperation` (
	`id` text PRIMARY KEY NOT NULL,
	`sourceDeviceId` text NOT NULL,
	`targetDeviceIds` text NOT NULL,
	`packageName` text NOT NULL,
	`appName` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`totalDevices` integer NOT NULL,
	`completedDevices` integer DEFAULT 0 NOT NULL,
	`failedDevices` integer DEFAULT 0 NOT NULL,
	`errorLog` text,
	`startedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completedAt` text,
	FOREIGN KEY (`sourceDeviceId`) REFERENCES `FireCubeDevice`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `FireCubeSideloadOperation_status_idx` ON `FireCubeSideloadOperation` (`status`);--> statement-breakpoint
CREATE INDEX `FireCubeSideloadOperation_startedAt_idx` ON `FireCubeSideloadOperation` (`startedAt`);--> statement-breakpoint
CREATE TABLE `FireCubeSportsContent` (
	`id` text PRIMARY KEY NOT NULL,
	`appId` text NOT NULL,
	`deviceId` text NOT NULL,
	`contentTitle` text NOT NULL,
	`contentType` text NOT NULL,
	`league` text,
	`teams` text,
	`startTime` text,
	`endTime` text,
	`channel` text,
	`isLive` integer DEFAULT false NOT NULL,
	`deepLink` text,
	`thumbnailUrl` text,
	`description` text,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`appId`) REFERENCES `FireCubeApp`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deviceId`) REFERENCES `FireCubeDevice`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `FireCubeSportsContent_deviceId_idx` ON `FireCubeSportsContent` (`deviceId`);--> statement-breakpoint
CREATE TABLE `Location` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`address` text,
	`city` text,
	`state` text,
	`zipCode` text,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`metadata` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Location_isActive_idx` ON `Location` (`isActive`);--> statement-breakpoint
CREATE TABLE `N8nWebhookLog` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`workflowId` text,
	`executionId` text,
	`payload` text NOT NULL,
	`response` text,
	`status` text DEFAULT 'success' NOT NULL,
	`errorMessage` text,
	`duration` integer NOT NULL,
	`metadata` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `N8nWebhookLog_action_idx` ON `N8nWebhookLog` (`action`);--> statement-breakpoint
CREATE INDEX `N8nWebhookLog_status_idx` ON `N8nWebhookLog` (`status`);--> statement-breakpoint
CREATE INDEX `N8nWebhookLog_createdAt_idx` ON `N8nWebhookLog` (`createdAt`);--> statement-breakpoint
CREATE INDEX `N8nWebhookLog_workflowId_idx` ON `N8nWebhookLog` (`workflowId`);--> statement-breakpoint
CREATE TABLE `N8nWorkflowConfig` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`workflowId` text,
	`description` text,
	`webhookUrl` text,
	`isActive` integer DEFAULT true NOT NULL,
	`triggerType` text DEFAULT 'manual' NOT NULL,
	`schedule` text,
	`actions` text NOT NULL,
	`metadata` text,
	`lastExecuted` text,
	`executionCount` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `N8nWorkflowConfig_workflowId_unique` ON `N8nWorkflowConfig` (`workflowId`);--> statement-breakpoint
CREATE INDEX `N8nWorkflowConfig_workflowId_idx` ON `N8nWorkflowConfig` (`workflowId`);--> statement-breakpoint
CREATE INDEX `N8nWorkflowConfig_isActive_idx` ON `N8nWorkflowConfig` (`isActive`);--> statement-breakpoint
CREATE TABLE `ScheduledCommandLog` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduledCommandId` text NOT NULL,
	`executedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`success` integer NOT NULL,
	`commandsSent` integer DEFAULT 0 NOT NULL,
	`commandsFailed` integer DEFAULT 0 NOT NULL,
	`executionTime` integer,
	`errorMessage` text,
	`details` text,
	`targetResults` text,
	FOREIGN KEY (`scheduledCommandId`) REFERENCES `ScheduledCommand`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ScheduledCommandLog_scheduledCommandId_idx` ON `ScheduledCommandLog` (`scheduledCommandId`);--> statement-breakpoint
CREATE INDEX `ScheduledCommandLog_executedAt_idx` ON `ScheduledCommandLog` (`executedAt`);--> statement-breakpoint
CREATE INDEX `ScheduledCommandLog_success_idx` ON `ScheduledCommandLog` (`success`);--> statement-breakpoint
CREATE TABLE `ScheduledCommand` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`commandType` text NOT NULL,
	`targetType` text NOT NULL,
	`targets` text NOT NULL,
	`commandSequence` text NOT NULL,
	`scheduleType` text NOT NULL,
	`scheduleData` text NOT NULL,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`lastExecuted` text,
	`nextExecution` text,
	`executionCount` integer DEFAULT 0 NOT NULL,
	`failureCount` integer DEFAULT 0 NOT NULL,
	`createdBy` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ScheduledCommand_commandType_idx` ON `ScheduledCommand` (`commandType`);--> statement-breakpoint
CREATE INDEX `ScheduledCommand_scheduleType_idx` ON `ScheduledCommand` (`scheduleType`);--> statement-breakpoint
CREATE INDEX `ScheduledCommand_enabled_idx` ON `ScheduledCommand` (`enabled`);--> statement-breakpoint
CREATE INDEX `ScheduledCommand_nextExecution_idx` ON `ScheduledCommand` (`nextExecution`);--> statement-breakpoint
CREATE TABLE `SecurityValidationLog` (
	`id` text PRIMARY KEY NOT NULL,
	`validationType` text NOT NULL,
	`operationType` text,
	`allowed` integer NOT NULL,
	`blockedReason` text,
	`blockedPatterns` text,
	`requestPath` text,
	`requestContent` text,
	`sanitizedInput` text,
	`severity` text DEFAULT 'info' NOT NULL,
	`ipAddress` text,
	`userId` text,
	`sessionId` text,
	`metadata` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `SecurityValidationLog_validationType_idx` ON `SecurityValidationLog` (`validationType`);--> statement-breakpoint
CREATE INDEX `SecurityValidationLog_allowed_idx` ON `SecurityValidationLog` (`allowed`);--> statement-breakpoint
CREATE INDEX `SecurityValidationLog_severity_idx` ON `SecurityValidationLog` (`severity`);--> statement-breakpoint
CREATE INDEX `SecurityValidationLog_timestamp_idx` ON `SecurityValidationLog` (`timestamp`);--> statement-breakpoint
CREATE INDEX `SecurityValidationLog_userId_idx` ON `SecurityValidationLog` (`userId`);--> statement-breakpoint
CREATE TABLE `Session` (
	`id` text PRIMARY KEY NOT NULL,
	`locationId` text NOT NULL,
	`role` text NOT NULL,
	`ipAddress` text NOT NULL,
	`userAgent` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expiresAt` text NOT NULL,
	`lastActivity` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Session_locationId_idx` ON `Session` (`locationId`);--> statement-breakpoint
CREATE INDEX `Session_isActive_idx` ON `Session` (`isActive`);--> statement-breakpoint
CREATE INDEX `Session_expiresAt_idx` ON `Session` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `Session_lastActivity_idx` ON `Session` (`lastActivity`);--> statement-breakpoint
CREATE TABLE `SportsEventSyncLog` (
	`id` text PRIMARY KEY NOT NULL,
	`league` text NOT NULL,
	`teamName` text,
	`syncType` text NOT NULL,
	`eventsFound` integer NOT NULL,
	`eventsAdded` integer NOT NULL,
	`eventsUpdated` integer NOT NULL,
	`success` integer NOT NULL,
	`errorMessage` text,
	`syncedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `SportsEventSyncLog_syncedAt_idx` ON `SportsEventSyncLog` (`syncedAt`);--> statement-breakpoint
CREATE INDEX `SportsEventSyncLog_league_idx` ON `SportsEventSyncLog` (`league`);--> statement-breakpoint
CREATE TABLE `SportsEvent` (
	`id` text PRIMARY KEY NOT NULL,
	`externalId` text,
	`sport` text NOT NULL,
	`league` text NOT NULL,
	`eventName` text NOT NULL,
	`homeTeam` text NOT NULL,
	`awayTeam` text NOT NULL,
	`homeTeamId` text,
	`eventDate` text NOT NULL,
	`eventTime` text,
	`venue` text,
	`city` text,
	`country` text,
	`channel` text,
	`importance` text DEFAULT 'normal' NOT NULL,
	`isHomeTeamFavorite` integer DEFAULT false,
	`preGameCheckCompleted` integer DEFAULT false,
	`preGameCheckTime` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`thumbnail` text,
	`description` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`homeTeamId`) REFERENCES `HomeTeam`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `SportsEvent_eventDate_idx` ON `SportsEvent` (`eventDate`);--> statement-breakpoint
CREATE INDEX `SportsEvent_league_idx` ON `SportsEvent` (`league`);--> statement-breakpoint
CREATE INDEX `SportsEvent_status_idx` ON `SportsEvent` (`status`);--> statement-breakpoint
CREATE INDEX `SportsEvent_importance_idx` ON `SportsEvent` (`importance`);--> statement-breakpoint
ALTER TABLE `SoundtrackPlayer` ADD `bartenderVisible` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `TrainingDocument` ADD `filePath` text NOT NULL;--> statement-breakpoint
ALTER TABLE `TrainingDocument` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `TrainingDocument` ADD `description` text;--> statement-breakpoint
ALTER TABLE `TrainingDocument` ADD `metadata` text;--> statement-breakpoint
ALTER TABLE `TrainingDocument` ADD `processedAt` text;--> statement-breakpoint
ALTER TABLE `TrainingDocument` ADD `viewCount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `TrainingDocument` ADD `lastViewed` text;--> statement-breakpoint
CREATE INDEX `TrainingDocument_category_idx` ON `TrainingDocument` (`category`);