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
CREATE TABLE `ai_venue_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`openTime` text DEFAULT '11:00' NOT NULL,
	`closeTime` text DEFAULT '02:00' NOT NULL,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`fillerChannels` text,
	`fillerApps` text,
	`defaultFillerMode` text DEFAULT 'sports_network' NOT NULL,
	`autoRunEnabled` integer DEFAULT false,
	`autoRunTime` text DEFAULT '09:00',
	`alwaysShowLocalTeams` integer DEFAULT true,
	`nationalGameBoost` integer DEFAULT 20,
	`playoffBoost` integer DEFAULT 30,
	`conflictStrategy` text DEFAULT 'priority',
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE `ArtistInterferenceProfile` (
	`id` text PRIMARY KEY NOT NULL,
	`artist_normalized` text NOT NULL,
	`location_id` text NOT NULL,
	`total_gigs` integer DEFAULT 0 NOT NULL,
	`gigs_with_interference` integer DEFAULT 0 NOT NULL,
	`avg_severity_dbm` real,
	`predicted_freqs_affected` text,
	`first_observed` integer,
	`last_observed` integer,
	`recommendation` text,
	`confidence` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ArtistInterferenceProfile_artist_idx` ON `ArtistInterferenceProfile` (`artist_normalized`);--> statement-breakpoint
CREATE INDEX `ArtistInterferenceProfile_location_idx` ON `ArtistInterferenceProfile` (`location_id`);--> statement-breakpoint
CREATE INDEX `ArtistInterferenceProfile_confidence_idx` ON `ArtistInterferenceProfile` (`confidence`);--> statement-breakpoint
CREATE UNIQUE INDEX `ArtistInterferenceProfile_artist_location_unique` ON `ArtistInterferenceProfile` (`artist_normalized`,`location_id`);--> statement-breakpoint
CREATE TABLE `AtlasConnectionState` (
	`id` text PRIMARY KEY NOT NULL,
	`processorId` text NOT NULL,
	`isConnected` integer DEFAULT false NOT NULL,
	`lastConnected` text,
	`lastDisconnected` text,
	`lastKeepAlive` text,
	`connectionErrors` integer DEFAULT 0 NOT NULL,
	`lastError` text,
	`reconnectAttempts` integer DEFAULT 0 NOT NULL,
	`tcpPort` integer DEFAULT 5321 NOT NULL,
	`udpPort` integer DEFAULT 3131 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AtlasConnectionState_processorId_unique` ON `AtlasConnectionState` (`processorId`);--> statement-breakpoint
CREATE TABLE `atlas_drop_events` (
	`id` text PRIMARY KEY NOT NULL,
	`processor_id` text NOT NULL,
	`zone_number` integer NOT NULL,
	`zone_name` text,
	`previous_volume` integer NOT NULL,
	`new_volume` integer NOT NULL,
	`delta` integer NOT NULL,
	`source_at_drop` integer,
	`muted_at_drop` integer DEFAULT false NOT NULL,
	`event_type` text DEFAULT 'drop' NOT NULL,
	`detected_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `AtlasLearningEvent` (
	`id` text PRIMARY KEY NOT NULL,
	`eventType` text NOT NULL,
	`processorId` text NOT NULL,
	`inputNumber` integer,
	`zoneNumber` integer,
	`success` integer NOT NULL,
	`previousGain` real,
	`newGain` real,
	`currentLevel` real,
	`targetLevel` real,
	`adjustmentMode` text,
	`movedTowardTarget` integer,
	`previousVolume` integer,
	`newVolume` integer,
	`muted` integer,
	`signalLevels` text,
	`clippingInputs` text,
	`errorMessage` text,
	`dayOfWeek` integer NOT NULL,
	`hourOfDay` integer NOT NULL,
	`durationMs` integer,
	`metadata` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `AtlasLearningEvent_eventType_idx` ON `AtlasLearningEvent` (`eventType`);--> statement-breakpoint
CREATE INDEX `AtlasLearningEvent_processorId_idx` ON `AtlasLearningEvent` (`processorId`);--> statement-breakpoint
CREATE INDEX `AtlasLearningEvent_createdAt_idx` ON `AtlasLearningEvent` (`createdAt`);--> statement-breakpoint
CREATE INDEX `AtlasLearningEvent_time_pattern_idx` ON `AtlasLearningEvent` (`dayOfWeek`,`hourOfDay`);--> statement-breakpoint
CREATE INDEX `AtlasLearningEvent_success_idx` ON `AtlasLearningEvent` (`success`);--> statement-breakpoint
CREATE INDEX `AtlasLearningEvent_inputNumber_idx` ON `AtlasLearningEvent` (`inputNumber`);--> statement-breakpoint
CREATE TABLE `AtlasMeterReading` (
	`id` text PRIMARY KEY NOT NULL,
	`processorId` text NOT NULL,
	`meterType` text NOT NULL,
	`meterIndex` integer NOT NULL,
	`meterName` text,
	`level` real NOT NULL,
	`peak` real,
	`clipping` integer DEFAULT false NOT NULL,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `AtlasMeterReading_processorId_meterType_meterIndex_idx` ON `AtlasMeterReading` (`processorId`,`meterType`,`meterIndex`);--> statement-breakpoint
CREATE INDEX `AtlasMeterReading_timestamp_idx` ON `AtlasMeterReading` (`timestamp`);--> statement-breakpoint
CREATE TABLE `AtlasParameter` (
	`id` text PRIMARY KEY NOT NULL,
	`processorId` text NOT NULL,
	`paramName` text NOT NULL,
	`paramType` text NOT NULL,
	`paramIndex` integer NOT NULL,
	`displayName` text,
	`minValue` real,
	`maxValue` real,
	`currentValue` text,
	`format` text DEFAULT 'val' NOT NULL,
	`readOnly` integer DEFAULT false NOT NULL,
	`isSubscribed` integer DEFAULT false NOT NULL,
	`lastUpdated` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AtlasParameter_processorId_paramName_key` ON `AtlasParameter` (`processorId`,`paramName`);--> statement-breakpoint
CREATE INDEX `AtlasParameter_processorId_paramType_idx` ON `AtlasParameter` (`processorId`,`paramType`);--> statement-breakpoint
CREATE TABLE `atlas_priority_events` (
	`id` text PRIMARY KEY NOT NULL,
	`processor_id` text NOT NULL,
	`event_type` text NOT NULL,
	`zone_number` integer,
	`zone_name` text,
	`previous_source` integer,
	`new_source` integer,
	`input_index` integer,
	`input_name` text,
	`input_level_db` real,
	`detected_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `atlas_priority_events_detected_at_idx` ON `atlas_priority_events` (`detected_at`);--> statement-breakpoint
CREATE INDEX `atlas_priority_events_processor_type_idx` ON `atlas_priority_events` (`processor_id`,`event_type`,`detected_at`);--> statement-breakpoint
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
CREATE TABLE `AudioProcessor` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`processorType` text DEFAULT 'atlas' NOT NULL,
	`ipAddress` text NOT NULL,
	`port` integer DEFAULT 80 NOT NULL,
	`tcpPort` integer DEFAULT 5321 NOT NULL,
	`connectionType` text DEFAULT 'ethernet' NOT NULL,
	`serialPort` text,
	`baudRate` integer DEFAULT 57600,
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
CREATE TABLE `audio_volume_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`processor_id` text NOT NULL,
	`zone_number` integer NOT NULL,
	`zone_name` text,
	`previous_volume` integer,
	`new_volume` integer NOT NULL,
	`changed_by` text DEFAULT 'bartender' NOT NULL,
	`active_game_id` text,
	`active_league` text,
	`active_home_team` text,
	`active_away_team` text,
	`is_home_game` integer,
	`day_of_week` text,
	`hour_of_day` integer,
	`time_slot` text,
	`current_source` text,
	`is_dj_mode` integer DEFAULT false,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `AudioVolumeLog_zone_idx` ON `audio_volume_logs` (`zone_number`);--> statement-breakpoint
CREATE INDEX `AudioVolumeLog_changedBy_idx` ON `audio_volume_logs` (`changed_by`);--> statement-breakpoint
CREATE INDEX `AudioVolumeLog_league_idx` ON `audio_volume_logs` (`active_league`);--> statement-breakpoint
CREATE INDEX `AudioVolumeLog_timeSlot_idx` ON `audio_volume_logs` (`time_slot`);--> statement-breakpoint
CREATE INDEX `AudioVolumeLog_createdAt_idx` ON `audio_volume_logs` (`created_at`);--> statement-breakpoint
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
	`channelMode` text DEFAULT 'mono' NOT NULL,
	`pairedZoneId` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AudioZone_processorId_zoneNumber_key` ON `AudioZone` (`processorId`,`zoneNumber`);--> statement-breakpoint
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
CREATE TABLE `AutoUpdateFailureSignatures` (
	`id` text PRIMARY KEY NOT NULL,
	`failedStep` text NOT NULL,
	`signature` text NOT NULL,
	`fullReason` text,
	`occurrences` integer DEFAULT 1 NOT NULL,
	`firstSeen` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`lastSeen` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`affectedVersions` text,
	`lastRunId` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `AutoUpdateFailureSignatures_step_idx` ON `AutoUpdateFailureSignatures` (`failedStep`);--> statement-breakpoint
CREATE UNIQUE INDEX `AutoUpdateFailureSignatures_step_sig_unique` ON `AutoUpdateFailureSignatures` (`failedStep`,`signature`);--> statement-breakpoint
CREATE TABLE `auto_update_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`result` text NOT NULL,
	`commit_sha_before` text NOT NULL,
	`commit_sha_after` text,
	`branch` text NOT NULL,
	`duration_secs` integer,
	`verify_result_json` text,
	`error_message` text,
	`triggered_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auto_update_state` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`schedule_cron` text DEFAULT '30 2 * * *' NOT NULL,
	`last_run_at` text,
	`last_result` text,
	`last_commit_sha_before` text,
	`last_commit_sha_after` text,
	`last_error` text,
	`last_duration_secs` integer,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `BartenderLayout` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`imageUrl` text,
	`originalFileUrl` text,
	`professionalImageUrl` text,
	`zones` text DEFAULT '[]' NOT NULL,
	`rooms` text DEFAULT '[]' NOT NULL,
	`isDefault` integer DEFAULT false NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `BartenderLayout_isDefault_idx` ON `BartenderLayout` (`isDefault`);--> statement-breakpoint
CREATE INDEX `BartenderLayout_isActive_idx` ON `BartenderLayout` (`isActive`);--> statement-breakpoint
CREATE INDEX `BartenderLayout_displayOrder_idx` ON `BartenderLayout` (`displayOrder`);--> statement-breakpoint
CREATE TABLE `bartender_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`tvId` text NOT NULL,
	`tvName` text NOT NULL,
	`lockedUntil` text NOT NULL,
	`lockType` text DEFAULT 'manual' NOT NULL,
	`currentGameId` text,
	`currentChannel` text,
	`currentInput` text,
	`gameEndTime` text,
	`gameEndBufferUntil` text,
	`overriddenBy` text DEFAULT 'bartender',
	`overrideReason` text,
	`unlockOnDeviceCrash` integer DEFAULT true,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `BartenderOverrides_tvId_idx` ON `bartender_overrides` (`tvId`);--> statement-breakpoint
CREATE INDEX `BartenderOverrides_lockedUntil_idx` ON `bartender_overrides` (`lockedUntil`);--> statement-breakpoint
CREATE INDEX `BartenderOverrides_lockType_idx` ON `bartender_overrides` (`lockType`);--> statement-breakpoint
CREATE TABLE `CableBox` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cecDeviceId` text,
	`matrixInputId` text,
	`provider` text DEFAULT 'spectrum' NOT NULL,
	`model` text DEFAULT 'spectrum-100h' NOT NULL,
	`lastChannel` text,
	`currentProgram` text,
	`currentProgramUpdatedAt` text,
	`isOnline` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `CableBox_matrixInputId_idx` ON `CableBox` (`matrixInputId`);--> statement-breakpoint
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
CREATE TABLE `ChannelTuneLog` (
	`id` text PRIMARY KEY NOT NULL,
	`inputNum` integer,
	`inputLabel` text,
	`deviceType` text NOT NULL,
	`deviceId` text,
	`cableBoxId` text,
	`channelNumber` text NOT NULL,
	`channelName` text,
	`presetId` text,
	`triggeredBy` text DEFAULT 'bartender' NOT NULL,
	`success` integer NOT NULL,
	`errorMessage` text,
	`durationMs` integer,
	`correlationId` text,
	`tunedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ChannelTuneLog_tunedAt_idx` ON `ChannelTuneLog` (`tunedAt`);--> statement-breakpoint
CREATE INDEX `ChannelTuneLog_inputNum_idx` ON `ChannelTuneLog` (`inputNum`);--> statement-breakpoint
CREATE INDEX `ChannelTuneLog_deviceType_idx` ON `ChannelTuneLog` (`deviceType`);--> statement-breakpoint
CREATE TABLE `ChatSession` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`messages` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `CommercialLightingDevice` (
	`id` text PRIMARY KEY NOT NULL,
	`systemId` text NOT NULL,
	`zoneId` text,
	`name` text NOT NULL,
	`externalId` text NOT NULL,
	`deviceType` text NOT NULL,
	`capabilities` text,
	`minLevel` integer DEFAULT 0 NOT NULL,
	`maxLevel` integer DEFAULT 100 NOT NULL,
	`currentLevel` integer DEFAULT 0 NOT NULL,
	`isOn` integer DEFAULT false NOT NULL,
	`colorHex` text,
	`colorTemp` integer,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`systemId`) REFERENCES `CommercialLightingSystem`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`zoneId`) REFERENCES `CommercialLightingZone`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `CommercialLightingDevice_systemId_idx` ON `CommercialLightingDevice` (`systemId`);--> statement-breakpoint
CREATE INDEX `CommercialLightingDevice_zoneId_idx` ON `CommercialLightingDevice` (`zoneId`);--> statement-breakpoint
CREATE INDEX `CommercialLightingDevice_deviceType_idx` ON `CommercialLightingDevice` (`deviceType`);--> statement-breakpoint
CREATE TABLE `CommercialLightingLog` (
	`id` text PRIMARY KEY NOT NULL,
	`systemId` text,
	`actionType` text NOT NULL,
	`targetId` text,
	`targetName` text,
	`value` text,
	`success` integer NOT NULL,
	`errorMessage` text,
	`triggeredBy` text,
	`metadata` text,
	`executedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`systemId`) REFERENCES `CommercialLightingSystem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CommercialLightingLog_systemId_idx` ON `CommercialLightingLog` (`systemId`);--> statement-breakpoint
CREATE INDEX `CommercialLightingLog_actionType_idx` ON `CommercialLightingLog` (`actionType`);--> statement-breakpoint
CREATE INDEX `CommercialLightingLog_executedAt_idx` ON `CommercialLightingLog` (`executedAt`);--> statement-breakpoint
CREATE TABLE `CommercialLightingScene` (
	`id` text PRIMARY KEY NOT NULL,
	`systemId` text,
	`name` text NOT NULL,
	`description` text,
	`externalId` text,
	`triggerDeviceId` text,
	`triggerButtonId` integer,
	`sceneData` text,
	`category` text DEFAULT 'general' NOT NULL,
	`bartenderVisible` integer DEFAULT true NOT NULL,
	`isFavorite` integer DEFAULT false NOT NULL,
	`iconName` text,
	`iconColor` text,
	`usageCount` integer DEFAULT 0 NOT NULL,
	`lastUsed` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`systemId`) REFERENCES `CommercialLightingSystem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CommercialLightingScene_systemId_idx` ON `CommercialLightingScene` (`systemId`);--> statement-breakpoint
CREATE INDEX `CommercialLightingScene_category_idx` ON `CommercialLightingScene` (`category`);--> statement-breakpoint
CREATE INDEX `CommercialLightingScene_bartenderVisible_idx` ON `CommercialLightingScene` (`bartenderVisible`);--> statement-breakpoint
CREATE TABLE `CommercialLightingSystem` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`systemType` text NOT NULL,
	`ipAddress` text NOT NULL,
	`port` integer,
	`username` text,
	`password` text,
	`applicationKey` text,
	`certificate` text,
	`status` text DEFAULT 'offline' NOT NULL,
	`lastSeen` text,
	`firmwareVersion` text,
	`lastError` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `CommercialLightingSystem_systemType_idx` ON `CommercialLightingSystem` (`systemType`);--> statement-breakpoint
CREATE INDEX `CommercialLightingSystem_status_idx` ON `CommercialLightingSystem` (`status`);--> statement-breakpoint
CREATE TABLE `CommercialLightingZone` (
	`id` text PRIMARY KEY NOT NULL,
	`systemId` text NOT NULL,
	`name` text NOT NULL,
	`externalId` text,
	`zoneType` text,
	`currentLevel` integer DEFAULT 0 NOT NULL,
	`isOn` integer DEFAULT false NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`bartenderVisible` integer DEFAULT true NOT NULL,
	`iconName` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`systemId`) REFERENCES `CommercialLightingSystem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `CommercialLightingZone_systemId_idx` ON `CommercialLightingZone` (`systemId`);--> statement-breakpoint
CREATE INDEX `CommercialLightingZone_bartenderVisible_idx` ON `CommercialLightingZone` (`bartenderVisible`);--> statement-breakpoint
CREATE TABLE `CrestronMatrix` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`ipAddress` text NOT NULL,
	`port` integer DEFAULT 23 NOT NULL,
	`username` text,
	`password` text,
	`description` text,
	`status` text DEFAULT 'unknown',
	`lastSeen` text,
	`inputs` integer DEFAULT 8 NOT NULL,
	`outputs` integer DEFAULT 8 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `DeviceStreamingLogin` (
	`id` text PRIMARY KEY NOT NULL,
	`deviceId` text NOT NULL,
	`serviceId` text NOT NULL,
	`isLoggedIn` integer DEFAULT true NOT NULL,
	`lastVerified` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`serviceId`) REFERENCES `StreamingService`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_service_idx` ON `DeviceStreamingLogin` (`deviceId`,`serviceId`);--> statement-breakpoint
CREATE TABLE `DeviceSubscription` (
	`id` text PRIMARY KEY NOT NULL,
	`deviceId` text NOT NULL,
	`deviceType` text NOT NULL,
	`deviceName` text NOT NULL,
	`subscriptions` text DEFAULT '[]' NOT NULL,
	`lastPolled` text,
	`pollStatus` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DeviceSubscription_deviceId_idx` ON `DeviceSubscription` (`deviceId`);--> statement-breakpoint
CREATE INDEX `DeviceSubscription_deviceType_idx` ON `DeviceSubscription` (`deviceType`);--> statement-breakpoint
CREATE TABLE `DirecTVDevice` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ipAddress` text NOT NULL,
	`port` integer DEFAULT 8080 NOT NULL,
	`deviceType` text DEFAULT 'DirecTV' NOT NULL,
	`inputChannel` integer,
	`receiverId` text,
	`receiverType` text DEFAULT 'Genie HD DVR',
	`isOnline` integer DEFAULT false NOT NULL,
	`addedAt` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DirecTVDevice_ipAddress_unique` ON `DirecTVDevice` (`ipAddress`);--> statement-breakpoint
CREATE TABLE `discovered_ppv_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`directv_device_id` text NOT NULL,
	`channel_major` integer NOT NULL,
	`channel_minor` integer,
	`callsign` text,
	`title` text,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`seen_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discovered_ppv_channels_device_major_unique` ON `discovered_ppv_channels` (`directv_device_id`,`channel_major`);--> statement-breakpoint
CREATE INDEX `discovered_ppv_channels_lastSeen_idx` ON `discovered_ppv_channels` (`last_seen_at`);--> statement-breakpoint
CREATE TABLE `DMXController` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`controllerType` text NOT NULL,
	`serialPort` text,
	`baudRate` integer DEFAULT 250000,
	`adapterModel` text,
	`ipAddress` text,
	`artnetPort` integer DEFAULT 6454,
	`artnetSubnet` integer DEFAULT 0,
	`artnetNet` integer DEFAULT 0,
	`universeStart` integer DEFAULT 0 NOT NULL,
	`universeCount` integer DEFAULT 1 NOT NULL,
	`maestroPresetCount` integer,
	`maestroFunctionCount` integer,
	`description` text,
	`status` text DEFAULT 'offline' NOT NULL,
	`lastSeen` text,
	`lastError` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `DMXController_controllerType_idx` ON `DMXController` (`controllerType`);--> statement-breakpoint
CREATE INDEX `DMXController_status_idx` ON `DMXController` (`status`);--> statement-breakpoint
CREATE TABLE `DMXExecutionLog` (
	`id` text PRIMARY KEY NOT NULL,
	`controllerId` text,
	`actionType` text NOT NULL,
	`actionId` text,
	`actionName` text,
	`success` integer NOT NULL,
	`errorMessage` text,
	`triggeredBy` text,
	`metadata` text,
	`executedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`controllerId`) REFERENCES `DMXController`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `DMXExecutionLog_controllerId_idx` ON `DMXExecutionLog` (`controllerId`);--> statement-breakpoint
CREATE INDEX `DMXExecutionLog_actionType_idx` ON `DMXExecutionLog` (`actionType`);--> statement-breakpoint
CREATE INDEX `DMXExecutionLog_executedAt_idx` ON `DMXExecutionLog` (`executedAt`);--> statement-breakpoint
CREATE TABLE `DMXFixture` (
	`id` text PRIMARY KEY NOT NULL,
	`controllerId` text NOT NULL,
	`zoneId` text,
	`name` text NOT NULL,
	`fixtureType` text NOT NULL,
	`manufacturer` text,
	`model` text,
	`universe` integer DEFAULT 0 NOT NULL,
	`startAddress` integer NOT NULL,
	`channelCount` integer NOT NULL,
	`channelMap` text NOT NULL,
	`capabilities` text,
	`currentState` text,
	`isActive` integer DEFAULT true NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`controllerId`) REFERENCES `DMXController`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`zoneId`) REFERENCES `DMXZone`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `DMXFixture_controllerId_idx` ON `DMXFixture` (`controllerId`);--> statement-breakpoint
CREATE INDEX `DMXFixture_zoneId_idx` ON `DMXFixture` (`zoneId`);--> statement-breakpoint
CREATE INDEX `DMXFixture_universe_startAddress_idx` ON `DMXFixture` (`universe`,`startAddress`);--> statement-breakpoint
CREATE INDEX `DMXFixture_fixtureType_idx` ON `DMXFixture` (`fixtureType`);--> statement-breakpoint
CREATE TABLE `DMXGameEventTrigger` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`eventType` text NOT NULL,
	`sportFilter` text,
	`teamFilter` text,
	`homeTeamOnly` integer DEFAULT true NOT NULL,
	`effectType` text NOT NULL,
	`sceneId` text,
	`maestroControllerId` text,
	`maestroPresetNumber` integer,
	`effectConfig` text,
	`durationMs` integer DEFAULT 5000 NOT NULL,
	`cooldownMs` integer DEFAULT 30000 NOT NULL,
	`lastTriggered` text,
	`isEnabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sceneId`) REFERENCES `DMXScene`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`maestroControllerId`) REFERENCES `DMXController`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `DMXGameEventTrigger_eventType_idx` ON `DMXGameEventTrigger` (`eventType`);--> statement-breakpoint
CREATE INDEX `DMXGameEventTrigger_isEnabled_idx` ON `DMXGameEventTrigger` (`isEnabled`);--> statement-breakpoint
CREATE TABLE `DMXScene` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'general' NOT NULL,
	`sceneData` text NOT NULL,
	`fadeTimeMs` integer DEFAULT 500 NOT NULL,
	`maestroControllerId` text,
	`maestroPresetNumber` integer,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`isFavorite` integer DEFAULT false NOT NULL,
	`bartenderVisible` integer DEFAULT true NOT NULL,
	`iconName` text,
	`iconColor` text,
	`usageCount` integer DEFAULT 0 NOT NULL,
	`lastUsed` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`maestroControllerId`) REFERENCES `DMXController`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `DMXScene_category_idx` ON `DMXScene` (`category`);--> statement-breakpoint
CREATE INDEX `DMXScene_isFavorite_idx` ON `DMXScene` (`isFavorite`);--> statement-breakpoint
CREATE INDEX `DMXScene_bartenderVisible_idx` ON `DMXScene` (`bartenderVisible`);--> statement-breakpoint
CREATE TABLE `DMXZone` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `DMXZone_isActive_idx` ON `DMXZone` (`isActive`);--> statement-breakpoint
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
CREATE TABLE `EverPassDevice` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cecDevicePath` text NOT NULL,
	`inputChannel` integer NOT NULL,
	`deviceModel` text,
	`isOnline` integer DEFAULT false NOT NULL,
	`lastSeen` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE `FireTVDevice` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ipAddress` text NOT NULL,
	`port` integer DEFAULT 5555 NOT NULL,
	`macAddress` text,
	`deviceType` text DEFAULT 'Fire TV Cube' NOT NULL,
	`inputChannel` integer,
	`location` text,
	`isOnline` integer DEFAULT false NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`adbEnabled` integer,
	`serialNumber` text,
	`deviceModel` text,
	`softwareVersion` text,
	`model` text,
	`keepAwakeEnabled` integer,
	`keepAwakeStart` text,
	`keepAwakeEnd` text,
	`status` text DEFAULT 'offline' NOT NULL,
	`lastSeen` text,
	`addedAt` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `FireTVDevice_ipAddress_unique` ON `FireTVDevice` (`ipAddress`);--> statement-breakpoint
CREATE TABLE `firestick_app_registry` (
	`id` text PRIMARY KEY NOT NULL,
	`packageName` text NOT NULL,
	`appName` text NOT NULL,
	`appCategory` text DEFAULT 'streaming' NOT NULL,
	`deepLinkPattern` text,
	`searchDeepLink` text,
	`homeDeepLink` text,
	`hasSportsContent` integer DEFAULT false,
	`supportedLeagues` text,
	`requiresSubscription` integer DEFAULT true,
	`launchCommand` text,
	`forceStopCommand` text,
	`scoreRegexPattern` text,
	`gameStatusRegexPattern` text,
	`logoUrl` text,
	`isActive` integer DEFAULT true,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `firestick_app_registry_packageName_unique` ON `firestick_app_registry` (`packageName`);--> statement-breakpoint
CREATE TABLE `firestick_live_status` (
	`id` text PRIMARY KEY NOT NULL,
	`deviceId` text NOT NULL,
	`deviceName` text NOT NULL,
	`ipAddress` text,
	`currentApp` text,
	`currentAppName` text,
	`appCategory` text,
	`currentGame` text,
	`homeTeam` text,
	`awayTeam` text,
	`homeScore` text,
	`awayScore` text,
	`gameStatus` text,
	`league` text,
	`installedApps` text,
	`loggedInApps` text,
	`isOnline` integer DEFAULT false,
	`lastHeartbeat` text,
	`scoutVersion` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `firestick_live_status_deviceId_unique` ON `firestick_live_status` (`deviceId`);--> statement-breakpoint
CREATE INDEX `FirestickLiveStatus_deviceId_idx` ON `firestick_live_status` (`deviceId`);--> statement-breakpoint
CREATE INDEX `FirestickLiveStatus_currentApp_idx` ON `firestick_live_status` (`currentApp`);--> statement-breakpoint
CREATE INDEX `FirestickLiveStatus_isOnline_idx` ON `firestick_live_status` (`isOnline`);--> statement-breakpoint
CREATE TABLE `firetv_streaming_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`deviceId` text NOT NULL,
	`app` text NOT NULL,
	`contentTitle` text NOT NULL,
	`deepLink` text,
	`isLive` integer DEFAULT false,
	`sportTag` text,
	`startTime` integer,
	`capturedAt` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	`source` text DEFAULT 'walker' NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `firetv_catalog_device_app_idx` ON `firetv_streaming_catalog` (`deviceId`,`app`);--> statement-breakpoint
CREATE INDEX `firetv_catalog_expires_idx` ON `firetv_streaming_catalog` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `firetv_catalog_device_app_source_idx` ON `firetv_streaming_catalog` (`deviceId`,`app`,`source`);--> statement-breakpoint
CREATE TABLE `game_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`espn_event_id` text NOT NULL,
	`espn_competition_id` text NOT NULL,
	`sport` text NOT NULL,
	`league` text NOT NULL,
	`home_team_id` text,
	`away_team_id` text,
	`home_team_espn_id` text NOT NULL,
	`away_team_espn_id` text NOT NULL,
	`home_team_name` text NOT NULL,
	`away_team_name` text NOT NULL,
	`home_team_abbr` text,
	`away_team_abbr` text,
	`scheduled_start` integer NOT NULL,
	`estimated_end` integer NOT NULL,
	`actual_start` integer,
	`actual_end` integer,
	`duration_minutes` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`status_detail` text,
	`current_period` integer,
	`clock_time` text,
	`home_score` integer DEFAULT 0,
	`away_score` integer DEFAULT 0,
	`season_type` integer NOT NULL,
	`season_year` integer NOT NULL,
	`week_number` integer,
	`week_text` text,
	`playoff_round` text,
	`tournament_name` text,
	`primary_network` text,
	`broadcast_networks` text,
	`streaming_services` text,
	`venue_name` text,
	`venue_city` text,
	`venue_state` text,
	`is_neutral_site` integer DEFAULT false,
	`calculated_priority` integer DEFAULT 0,
	`priority_factors` text,
	`is_priority_game` integer DEFAULT false,
	`last_synced` integer DEFAULT (strftime('%s', 'now')),
	`sync_source` text DEFAULT 'espn',
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_schedules_espn_event_id_unique` ON `game_schedules` (`espn_event_id`);--> statement-breakpoint
CREATE INDEX `GameSchedule_scheduledStart_idx` ON `game_schedules` (`scheduled_start`);--> statement-breakpoint
CREATE INDEX `GameSchedule_status_idx` ON `game_schedules` (`status`);--> statement-breakpoint
CREATE INDEX `GameSchedule_homeTeamId_idx` ON `game_schedules` (`home_team_id`);--> statement-breakpoint
CREATE INDEX `GameSchedule_awayTeamId_idx` ON `game_schedules` (`away_team_id`);--> statement-breakpoint
CREATE INDEX `GameSchedule_isPriorityGame_scheduledStart_idx` ON `game_schedules` (`is_priority_game`,`scheduled_start`);--> statement-breakpoint
CREATE INDEX `GameSchedule_seasonType_scheduledStart_idx` ON `game_schedules` (`season_type`,`scheduled_start`);--> statement-breakpoint
CREATE INDEX `GameSchedule_espnEventId_idx` ON `game_schedules` (`espn_event_id`);--> statement-breakpoint
CREATE INDEX `GameSchedule_league_idx` ON `game_schedules` (`league`);--> statement-breakpoint
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
	`aliases` text,
	`cityAbbreviations` text,
	`teamAbbreviations` text,
	`commonVariations` text,
	`matchingStrategy` text DEFAULT 'fuzzy',
	`minMatchConfidence` real DEFAULT 0.7,
	`minTVsWhenActive` integer DEFAULT 1,
	`autoPromotePlayoffs` integer DEFAULT true,
	`preferredZones` text,
	`rivalTeams` text,
	`schedulerNotes` text,
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
CREATE TABLE `InputChannelListEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`listId` text NOT NULL,
	`channelNumber` text NOT NULL,
	`channelName` text NOT NULL,
	`callsign` text,
	`network` text,
	`category` text DEFAULT 'sports' NOT NULL,
	`isHD` integer DEFAULT false NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`lastVerified` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`listId`) REFERENCES `InputChannelList`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `InputChannelListEntry_listId_idx` ON `InputChannelListEntry` (`listId`);--> statement-breakpoint
CREATE UNIQUE INDEX `InputChannelListEntry_listId_channelNumber_key` ON `InputChannelListEntry` (`listId`,`channelNumber`);--> statement-breakpoint
CREATE INDEX `InputChannelListEntry_isActive_idx` ON `InputChannelListEntry` (`isActive`);--> statement-breakpoint
CREATE TABLE `InputChannelList` (
	`id` text PRIMARY KEY NOT NULL,
	`matrixInputId` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `InputChannelList_matrixInputId_unique` ON `InputChannelList` (`matrixInputId`);--> statement-breakpoint
CREATE TABLE `InputCurrentChannel` (
	`id` text PRIMARY KEY NOT NULL,
	`inputNum` integer NOT NULL,
	`inputLabel` text NOT NULL,
	`deviceType` text NOT NULL,
	`deviceId` text,
	`channelNumber` text NOT NULL,
	`channelName` text,
	`showName` text,
	`presetId` text,
	`lastTuned` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`manualOverrideUntil` text,
	`lastManualChangeBy` text,
	`lastManualChangeAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `InputCurrentChannel_inputNum_unique` ON `InputCurrentChannel` (`inputNum`);--> statement-breakpoint
CREATE INDEX `InputCurrentChannel_inputNum_idx` ON `InputCurrentChannel` (`inputNum`);--> statement-breakpoint
CREATE INDEX `InputCurrentChannel_deviceType_idx` ON `InputCurrentChannel` (`deviceType`);--> statement-breakpoint
CREATE INDEX `InputCurrentChannel_manualOverrideUntil_idx` ON `InputCurrentChannel` (`manualOverrideUntil`);--> statement-breakpoint
CREATE TABLE `input_source_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`input_source_id` text NOT NULL,
	`input_source_type` text NOT NULL,
	`game_schedule_id` text NOT NULL,
	`channel_number` text,
	`app_name` text,
	`stream_url` text,
	`deep_link` text,
	`tv_output_ids` text NOT NULL,
	`tv_count` integer NOT NULL,
	`allocated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`expected_free_at` integer NOT NULL,
	`actually_freed_at` integer,
	`revert_attempted_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`scheduled_by` text DEFAULT 'ai',
	`preempted_by_allocation_id` text,
	`preempted_reason` text,
	`audio_source_index` integer,
	`audio_source_name` text,
	`audio_zone_ids` text,
	`allocation_quality` text,
	`quality_notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`input_source_id`) REFERENCES `input_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_schedule_id`) REFERENCES `game_schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`preempted_by_allocation_id`) REFERENCES `input_source_allocations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `InputSourceAllocation_inputSourceId_status_idx` ON `input_source_allocations` (`input_source_id`,`status`);--> statement-breakpoint
CREATE INDEX `InputSourceAllocation_gameScheduleId_idx` ON `input_source_allocations` (`game_schedule_id`);--> statement-breakpoint
CREATE INDEX `InputSourceAllocation_status_expectedFreeAt_idx` ON `input_source_allocations` (`status`,`expected_free_at`);--> statement-breakpoint
CREATE INDEX `InputSourceAllocation_preemptedByAllocationId_idx` ON `input_source_allocations` (`preempted_by_allocation_id`);--> statement-breakpoint
CREATE TABLE `input_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`device_id` text,
	`connection_type` text,
	`matrix_input_id` text,
	`available_networks` text NOT NULL,
	`installed_apps` text,
	`max_quality` text,
	`is_active` integer DEFAULT true,
	`currently_allocated` integer DEFAULT false,
	`current_channel` text,
	`current_app` text,
	`priority_rank` integer DEFAULT 50,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `InputSource_type_idx` ON `input_sources` (`type`);--> statement-breakpoint
CREATE INDEX `InputSource_isActive_currentlyAllocated_idx` ON `input_sources` (`is_active`,`currently_allocated`);--> statement-breakpoint
CREATE INDEX `InputSource_deviceId_idx` ON `input_sources` (`device_id`);--> statement-breakpoint
CREATE TABLE `InterferenceAttribution` (
	`id` text PRIMARY KEY NOT NULL,
	`rf_event_id` text NOT NULL,
	`neighborhood_event_id` text NOT NULL,
	`time_delta_seconds` integer NOT NULL,
	`distance_mi` real NOT NULL,
	`confidence` real NOT NULL,
	`attribution_method` text DEFAULT 'correlation_v1' NOT NULL,
	`source` text DEFAULT 'shure' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`rf_event_id`) REFERENCES `shure_rf_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`neighborhood_event_id`) REFERENCES `NeighborhoodEvent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `InterferenceAttribution_rfEvent_idx` ON `InterferenceAttribution` (`rf_event_id`);--> statement-breakpoint
CREATE INDEX `InterferenceAttribution_neighborhoodEvent_idx` ON `InterferenceAttribution` (`neighborhood_event_id`);--> statement-breakpoint
CREATE INDEX `InterferenceAttribution_source_idx` ON `InterferenceAttribution` (`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `InterferenceAttribution_rfEvent_neighborhoodEvent_unique` ON `InterferenceAttribution` (`rf_event_id`,`neighborhood_event_id`);--> statement-breakpoint
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
	`irCodes` text,
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
CREATE TABLE `local_channel_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`team_name` text NOT NULL,
	`channel_number` integer NOT NULL,
	`channel_name` text NOT NULL,
	`device_type` text DEFAULT 'cable',
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `Location` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`address` text,
	`city` text,
	`state` text,
	`zipCode` text,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`latitude` real,
	`longitude` real,
	`lastGeocodedAt` text,
	`isActive` integer DEFAULT true NOT NULL,
	`metadata` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Location_isActive_idx` ON `Location` (`isActive`);--> statement-breakpoint
CREATE TABLE `MatrixConfiguration` (
	`id` text PRIMARY KEY NOT NULL,
	`chassisId` text,
	`name` text NOT NULL,
	`model` text DEFAULT 'WP-36X36' NOT NULL,
	`ipAddress` text NOT NULL,
	`tcpPort` integer DEFAULT 23 NOT NULL,
	`udpPort` integer DEFAULT 4000 NOT NULL,
	`protocol` text DEFAULT 'HTTP' NOT NULL,
	`inputCount` integer DEFAULT 36 NOT NULL,
	`outputCount` integer DEFAULT 36 NOT NULL,
	`outputOffset` integer DEFAULT 0 NOT NULL,
	`audioOutputCount` integer DEFAULT 4 NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
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
	`isSchedulingEnabled` integer DEFAULT true NOT NULL,
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
	`isSchedulingEnabled` integer DEFAULT true NOT NULL,
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
	`tvGroupId` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`configId`) REFERENCES `MatrixConfiguration`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `MatrixOutput_configId_channelNumber_key` ON `MatrixOutput` (`configId`,`channelNumber`);--> statement-breakpoint
CREATE TABLE `MatrixRoute` (
	`id` text PRIMARY KEY NOT NULL,
	`chassisId` text,
	`inputNum` integer NOT NULL,
	`outputNum` integer NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`manualOverrideUntil` text,
	`lastManualChangeBy` text,
	`lastManualChangeAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `MatrixRoute_outputNum_unique` ON `MatrixRoute` (`outputNum`);--> statement-breakpoint
CREATE INDEX `MatrixRoute_outputNum_idx` ON `MatrixRoute` (`outputNum`);--> statement-breakpoint
CREATE TABLE `NeighborhoodEvent` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`artist_name` text NOT NULL,
	`artist_normalized` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`event_type` text,
	`source` text NOT NULL,
	`source_url` text,
	`source_event_id` text,
	`raw_payload` text,
	`ingested_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`venue_id`) REFERENCES `NeighborhoodVenue`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `NeighborhoodEvent_venue_idx` ON `NeighborhoodEvent` (`venue_id`);--> statement-breakpoint
CREATE INDEX `NeighborhoodEvent_startTime_idx` ON `NeighborhoodEvent` (`start_time`);--> statement-breakpoint
CREATE INDEX `NeighborhoodEvent_artistNormalized_idx` ON `NeighborhoodEvent` (`artist_normalized`);--> statement-breakpoint
CREATE UNIQUE INDEX `NeighborhoodEvent_source_sourceEventId_unique` ON `NeighborhoodEvent` (`source`,`source_event_id`);--> statement-breakpoint
CREATE TABLE `NeighborhoodVenueAlias` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`alias_text` text NOT NULL,
	`alias_normalized` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`venue_id`) REFERENCES `NeighborhoodVenue`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `NeighborhoodVenueAlias_venue_idx` ON `NeighborhoodVenueAlias` (`venue_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `NeighborhoodVenueAlias_normalized_unique` ON `NeighborhoodVenueAlias` (`alias_normalized`);--> statement-breakpoint
CREATE TABLE `NeighborhoodVenue` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`distance_mi` real,
	`source_url` text,
	`bandsintown_venue_id` text,
	`facebook_event_url` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`review_status` text DEFAULT 'manual' NOT NULL,
	`discovery_source` text DEFAULT 'manual' NOT NULL,
	`osm_tags` text,
	`booking_confidence` real,
	`is_self` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `NeighborhoodVenue_category_idx` ON `NeighborhoodVenue` (`category`);--> statement-breakpoint
CREATE INDEX `NeighborhoodVenue_distance_idx` ON `NeighborhoodVenue` (`distance_mi`);--> statement-breakpoint
CREATE INDEX `NeighborhoodVenue_isActive_idx` ON `NeighborhoodVenue` (`is_active`);--> statement-breakpoint
CREATE INDEX `NeighborhoodVenue_reviewStatus_idx` ON `NeighborhoodVenue` (`review_status`);--> statement-breakpoint
CREATE INDEX `NeighborhoodVenue_isSelf_idx` ON `NeighborhoodVenue` (`is_self`);--> statement-breakpoint
CREATE UNIQUE INDEX `NeighborhoodVenue_name_category_unique` ON `NeighborhoodVenue` (`name`,`category`);--> statement-breakpoint
CREATE TABLE `NetworkTVDevice` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`ipAddress` text NOT NULL,
	`macAddress` text,
	`brand` text NOT NULL,
	`model` text,
	`port` integer NOT NULL,
	`authToken` text,
	`clientKey` text,
	`psk` text,
	`status` text DEFAULT 'offline' NOT NULL,
	`lastSeen` text,
	`matrixOutputId` text,
	`currentInput` text,
	`supportsPower` integer DEFAULT true NOT NULL,
	`supportsVolume` integer DEFAULT true NOT NULL,
	`supportsInput` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`matrixOutputId`) REFERENCES `MatrixOutput`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `NetworkTVDevice_ipAddress_unique` ON `NetworkTVDevice` (`ipAddress`);--> statement-breakpoint
CREATE INDEX `NetworkTVDevice_brand_idx` ON `NetworkTVDevice` (`brand`);--> statement-breakpoint
CREATE INDEX `NetworkTVDevice_status_idx` ON `NetworkTVDevice` (`status`);--> statement-breakpoint
CREATE INDEX `NetworkTVDevice_matrixOutputId_idx` ON `NetworkTVDevice` (`matrixOutputId`);--> statement-breakpoint
CREATE INDEX `NetworkTVDevice_ipAddress_idx` ON `NetworkTVDevice` (`ipAddress`);--> statement-breakpoint
CREATE TABLE `NFHSGame` (
	`id` text PRIMARY KEY NOT NULL,
	`schoolSlug` text NOT NULL,
	`sport` text NOT NULL,
	`level` text,
	`homeTeam` text NOT NULL,
	`awayTeam` text,
	`opponent` text,
	`date` text NOT NULL,
	`time` text,
	`dateTime` text,
	`location` text,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`eventUrl` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_nfhs_school` ON `NFHSGame` (`schoolSlug`);--> statement-breakpoint
CREATE INDEX `idx_nfhs_status` ON `NFHSGame` (`status`);--> statement-breakpoint
CREATE TABLE `NFHSSchool` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`state` text,
	`isActive` integer DEFAULT true NOT NULL,
	`lastSyncedAt` text,
	`lastSyncedGames` integer DEFAULT 0,
	`lastSyncError` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `NFHSSchool_slug_unique` ON `NFHSSchool` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_nfhs_school_active` ON `NFHSSchool` (`isActive`);--> statement-breakpoint
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
CREATE TABLE `rf_pattern_digest` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`summary_text` text NOT NULL,
	`structured_findings` text,
	`model_used` text NOT NULL,
	`prompt_token_count` integer,
	`completion_token_count` integer,
	`generation_ms` integer,
	`generated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rf_pattern_digest_location_idx` ON `rf_pattern_digest` (`location_id`,`generated_at`);--> statement-breakpoint
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
	`cron_expression` text,
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
CREATE TABLE `ScheduledOverrideDefaults` (
	`id` text PRIMARY KEY NOT NULL,
	`team` text NOT NULL,
	`league` text,
	`outputNum` integer NOT NULL,
	`action` text NOT NULL,
	`isHomeTeam` integer DEFAULT false NOT NULL,
	`occurrences` integer DEFAULT 1 NOT NULL,
	`sourceCorrelationId` text,
	`appliedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`appliedBy` text DEFAULT 'operator' NOT NULL,
	`notes` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ScheduledOverrideDefaults_team_idx` ON `ScheduledOverrideDefaults` (`team`);--> statement-breakpoint
CREATE UNIQUE INDEX `ScheduledOverrideDefaults_team_output_action_unique` ON `ScheduledOverrideDefaults` (`team`,`outputNum`,`action`);--> statement-breakpoint
CREATE TABLE `SchedulerLog` (
	`id` text PRIMARY KEY NOT NULL,
	`correlationId` text NOT NULL,
	`component` text NOT NULL,
	`operation` text NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`gameId` text,
	`inputSourceId` text,
	`allocationId` text,
	`channelNumber` text,
	`deviceType` text,
	`deviceId` text,
	`success` integer NOT NULL,
	`durationMs` integer,
	`errorMessage` text,
	`errorStack` text,
	`metadata` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `SchedulerLog_correlationId_idx` ON `SchedulerLog` (`correlationId`);--> statement-breakpoint
CREATE INDEX `SchedulerLog_component_idx` ON `SchedulerLog` (`component`);--> statement-breakpoint
CREATE INDEX `SchedulerLog_operation_idx` ON `SchedulerLog` (`operation`);--> statement-breakpoint
CREATE INDEX `SchedulerLog_level_idx` ON `SchedulerLog` (`level`);--> statement-breakpoint
CREATE INDEX `SchedulerLog_createdAt_idx` ON `SchedulerLog` (`createdAt`);--> statement-breakpoint
CREATE INDEX `SchedulerLog_success_idx` ON `SchedulerLog` (`success`);--> statement-breakpoint
CREATE INDEX `SchedulerLog_gameId_idx` ON `SchedulerLog` (`gameId`);--> statement-breakpoint
CREATE TABLE `SchedulerMetrics` (
	`id` text PRIMARY KEY NOT NULL,
	`metricType` text NOT NULL,
	`period` text NOT NULL,
	`periodStart` integer NOT NULL,
	`successCount` integer DEFAULT 0 NOT NULL,
	`failureCount` integer DEFAULT 0 NOT NULL,
	`totalCount` integer DEFAULT 0 NOT NULL,
	`totalDurationMs` integer DEFAULT 0 NOT NULL,
	`minDurationMs` integer,
	`maxDurationMs` integer,
	`avgDurationMs` integer,
	`componentBreakdown` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `SchedulerMetrics_metricType_idx` ON `SchedulerMetrics` (`metricType`);--> statement-breakpoint
CREATE INDEX `SchedulerMetrics_periodStart_idx` ON `SchedulerMetrics` (`periodStart`);--> statement-breakpoint
CREATE UNIQUE INDEX `SchedulerMetrics_type_period_start_idx` ON `SchedulerMetrics` (`metricType`,`period`,`periodStart`);--> statement-breakpoint
CREATE TABLE `Schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`deviceId` text,
	`channelName` text,
	`channelNumber` text,
	`startTime` text,
	`endTime` text,
	`recurring` integer DEFAULT false NOT NULL,
	`daysOfWeek` text,
	`enabled` integer DEFAULT true NOT NULL,
	`lastExecuted` text,
	`executionCount` integer DEFAULT 0 NOT NULL,
	`lastResult` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`description` text,
	`scheduleType` text,
	`executionTime` text,
	`powerOnTVs` integer DEFAULT true,
	`powerOffTVs` integer DEFAULT false,
	`selectedOutputs` text,
	`setDefaultChannels` integer DEFAULT false,
	`defaultChannelMap` text,
	`inputDefaultChannels` text,
	`autoFindGames` integer DEFAULT false,
	`monitorHomeTeams` integer DEFAULT false,
	`homeTeamIds` text,
	`preferredProviders` text,
	`executionOrder` text,
	`delayBetweenCommands` integer,
	`nextExecution` text,
	`audioSettings` text,
	`fillWithSports` integer DEFAULT true,
	FOREIGN KEY (`deviceId`) REFERENCES `FireTVDevice`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scheduling_patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern_type` text NOT NULL,
	`pattern_key` text NOT NULL,
	`pattern_data` text NOT NULL,
	`observation_count` integer DEFAULT 1 NOT NULL,
	`sample_size` integer DEFAULT 0 NOT NULL,
	`first_observed` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`last_observed` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`is_stale` integer DEFAULT false NOT NULL,
	`last_analyzed_at` integer DEFAULT (strftime('%s', 'now')),
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `SchedulingPattern_patternType_idx` ON `scheduling_patterns` (`pattern_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `SchedulingPattern_type_key_idx` ON `scheduling_patterns` (`pattern_type`,`pattern_key`);--> statement-breakpoint
CREATE INDEX `SchedulingPattern_confidence_idx` ON `scheduling_patterns` (`confidence`);--> statement-breakpoint
CREATE INDEX `SchedulingPattern_lastObserved_idx` ON `scheduling_patterns` (`last_observed`);--> statement-breakpoint
CREATE TABLE `scheduling_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`preference_type` text NOT NULL,
	`team_id` text,
	`team_name` text,
	`league` text,
	`preference_data` text NOT NULL,
	`weight` integer DEFAULT 50 NOT NULL,
	`confidence` real DEFAULT 0.5 NOT NULL,
	`source` text DEFAULT 'learned' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `SchedulingPreference_preferenceType_idx` ON `scheduling_preferences` (`preference_type`);--> statement-breakpoint
CREATE INDEX `SchedulingPreference_teamId_idx` ON `scheduling_preferences` (`team_id`);--> statement-breakpoint
CREATE INDEX `SchedulingPreference_league_idx` ON `scheduling_preferences` (`league`);--> statement-breakpoint
CREATE INDEX `SchedulingPreference_isActive_idx` ON `scheduling_preferences` (`is_active`);--> statement-breakpoint
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
CREATE TABLE `shure_rf_events` (
	`id` text PRIMARY KEY NOT NULL,
	`receiver_id` text NOT NULL,
	`receiver_name` text,
	`ip_address` text,
	`channel` integer DEFAULT 0 NOT NULL,
	`event_type` text NOT NULL,
	`rssi_dbm` real,
	`frequency_mhz` real,
	`tx_type` text,
	`note` text,
	`detected_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shure_rf_events_detected_at_idx` ON `shure_rf_events` (`detected_at`);--> statement-breakpoint
CREATE INDEX `shure_rf_events_receiver_idx` ON `shure_rf_events` (`receiver_id`,`channel`,`detected_at`);--> statement-breakpoint
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
	`bartenderVisible` integer DEFAULT false NOT NULL,
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
CREATE TABLE `station_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`standard_name` text NOT NULL,
	`aliases` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `station_aliases_standard_name_unique` ON `station_aliases` (`standard_name`);--> statement-breakpoint
CREATE TABLE `StreamingCredential` (
	`id` text PRIMARY KEY NOT NULL,
	`platformId` text NOT NULL,
	`username` text NOT NULL,
	`passwordHash` text NOT NULL,
	`encrypted` integer DEFAULT true NOT NULL,
	`encryptionVersion` text DEFAULT 'aes-256-gcm' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`lastSync` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `StreamingCredential_platformId_unique` ON `StreamingCredential` (`platformId`);--> statement-breakpoint
CREATE TABLE `StreamingService` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`stationCodes` text NOT NULL,
	`packages` text NOT NULL,
	`logoUrl` text,
	`category` text DEFAULT 'sports' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `StreamingService_name_unique` ON `StreamingService` (`name`);--> statement-breakpoint
CREATE TABLE `StreamingSubscription` (
	`id` text PRIMARY KEY NOT NULL,
	`serviceId` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`notes` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`serviceId`) REFERENCES `StreamingService`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `SubscribedStreamingApp` (
	`id` text PRIMARY KEY NOT NULL,
	`appId` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`activityName` text,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SubscribedStreamingApp_appId_unique` ON `SubscribedStreamingApp` (`appId`);--> statement-breakpoint
CREATE TABLE `SystemSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SystemSettings_key_unique` ON `SystemSettings` (`key`);--> statement-breakpoint
CREATE TABLE `TeamNameMatch` (
	`id` text PRIMARY KEY NOT NULL,
	`guideTeamName` text NOT NULL,
	`matchedTeamId` text,
	`matchedTeamName` text,
	`confidence` real NOT NULL,
	`matchMethod` text NOT NULL,
	`sport` text,
	`league` text,
	`isValidated` integer DEFAULT false,
	`isCorrect` integer,
	`validatedBy` text,
	`validatedAt` text,
	`matchCount` integer DEFAULT 1 NOT NULL,
	`lastMatchedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`matchedTeamId`) REFERENCES `HomeTeam`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TeamNameMatch_guideTeamName_idx` ON `TeamNameMatch` (`guideTeamName`);--> statement-breakpoint
CREATE INDEX `TeamNameMatch_matchedTeamId_idx` ON `TeamNameMatch` (`matchedTeamId`);--> statement-breakpoint
CREATE INDEX `TeamNameMatch_confidence_idx` ON `TeamNameMatch` (`confidence`);--> statement-breakpoint
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
CREATE TABLE `tournament_brackets` (
	`id` text PRIMARY KEY NOT NULL,
	`espnTournamentId` text,
	`tournamentName` text NOT NULL,
	`shortName` text,
	`seasonYear` integer NOT NULL,
	`sport` text NOT NULL,
	`league` text NOT NULL,
	`totalTeams` integer,
	`totalRounds` integer,
	`currentRound` integer,
	`roundName` text,
	`bracketStructure` text,
	`regions` text,
	`totalGames` integer,
	`gamesScheduled` integer,
	`gamesInProgress` integer,
	`gamesCompleted` integer,
	`tournamentStart` integer,
	`tournamentEnd` integer,
	`currentRoundStart` integer,
	`currentRoundEnd` integer,
	`status` text,
	`lastSynced` integer DEFAULT (strftime('%s', 'now')),
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_brackets_espnTournamentId_unique` ON `tournament_brackets` (`espnTournamentId`);--> statement-breakpoint
CREATE INDEX `TournamentBracket_seasonYear_sport_idx` ON `tournament_brackets` (`seasonYear`,`sport`);--> statement-breakpoint
CREATE INDEX `TournamentBracket_status_currentRound_idx` ON `tournament_brackets` (`status`,`currentRound`);--> statement-breakpoint
CREATE INDEX `TournamentBracket_league_idx` ON `tournament_brackets` (`league`);--> statement-breakpoint
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
CREATE TABLE `WolfpackLearningEvent` (
	`id` text PRIMARY KEY NOT NULL,
	`eventType` text NOT NULL,
	`chassisId` text,
	`inputNum` integer,
	`outputNum` integer,
	`inputLabel` text,
	`outputLabel` text,
	`success` integer NOT NULL,
	`durationMs` integer,
	`errorMessage` text,
	`dayOfWeek` integer NOT NULL,
	`hourOfDay` integer NOT NULL,
	`protocol` text,
	`retryCount` integer DEFAULT 0 NOT NULL,
	`wasRetrySuccessful` integer,
	`metadata` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `WolfpackLearningEvent_eventType_idx` ON `WolfpackLearningEvent` (`eventType`);--> statement-breakpoint
CREATE INDEX `WolfpackLearningEvent_chassisId_idx` ON `WolfpackLearningEvent` (`chassisId`);--> statement-breakpoint
CREATE INDEX `WolfpackLearningEvent_createdAt_idx` ON `WolfpackLearningEvent` (`createdAt`);--> statement-breakpoint
CREATE INDEX `WolfpackLearningEvent_time_pattern_idx` ON `WolfpackLearningEvent` (`dayOfWeek`,`hourOfDay`);--> statement-breakpoint
CREATE INDEX `WolfpackLearningEvent_success_idx` ON `WolfpackLearningEvent` (`success`);--> statement-breakpoint
CREATE TABLE `WolfpackMatrixRouting` (
	`id` text PRIMARY KEY NOT NULL,
	`chassisId` text,
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
	`chassisId` text,
	`matrixOutputNumber` integer NOT NULL,
	`wolfpackInputNumber` integer NOT NULL,
	`wolfpackInputLabel` text NOT NULL,
	`channelInfo` text,
	`routedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `WolfpackMatrixState_matrixOutputNumber_idx` ON `WolfpackMatrixState` (`matrixOutputNumber`);--> statement-breakpoint
CREATE INDEX `WolfpackMatrixState_routedAt_idx` ON `WolfpackMatrixState` (`routedAt`);--> statement-breakpoint
CREATE TABLE `WolfpackMultiViewCard` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`startSlot` integer NOT NULL,
	`endSlot` integer NOT NULL,
	`serialPort` text NOT NULL,
	`baudRate` integer DEFAULT 115200 NOT NULL,
	`currentMode` integer DEFAULT 0 NOT NULL,
	`inputAssignments` text,
	`status` text DEFAULT 'unknown',
	`lastSeen` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
