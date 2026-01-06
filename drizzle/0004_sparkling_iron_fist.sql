PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_CableBox` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cecDeviceId` text,
	`matrixInputId` text,
	`provider` text DEFAULT 'spectrum' NOT NULL,
	`model` text DEFAULT 'spectrum-100h' NOT NULL,
	`lastChannel` text,
	`isOnline` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_CableBox`("id", "name", "cecDeviceId", "matrixInputId", "provider", "model", "lastChannel", "isOnline", "createdAt", "updatedAt") SELECT "id", "name", "cecDeviceId", "matrixInputId", "provider", "model", "lastChannel", "isOnline", "createdAt", "updatedAt" FROM `CableBox`;--> statement-breakpoint
DROP TABLE `CableBox`;--> statement-breakpoint
ALTER TABLE `__new_CableBox` RENAME TO `CableBox`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `CableBox_matrixInputId_idx` ON `CableBox` (`matrixInputId`);--> statement-breakpoint
CREATE TABLE `__new_CECDevice` (
	`id` text PRIMARY KEY NOT NULL,
	`devicePath` text NOT NULL,
	`deviceType` text DEFAULT 'tv_power' NOT NULL,
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
INSERT INTO `__new_CECDevice`("id", "devicePath", "deviceType", "deviceName", "matrixInputId", "cecAddress", "vendorId", "productId", "serialNumber", "firmwareVersion", "isActive", "lastSeen", "createdAt", "updatedAt") SELECT "id", "devicePath", "deviceType", "deviceName", "matrixInputId", "cecAddress", "vendorId", "productId", "serialNumber", "firmwareVersion", "isActive", "lastSeen", "createdAt", "updatedAt" FROM `CECDevice`;--> statement-breakpoint
DROP TABLE `CECDevice`;--> statement-breakpoint
ALTER TABLE `__new_CECDevice` RENAME TO `CECDevice`;--> statement-breakpoint
CREATE UNIQUE INDEX `CECDevice_devicePath_unique` ON `CECDevice` (`devicePath`);--> statement-breakpoint
CREATE INDEX `CECDevice_devicePath_idx` ON `CECDevice` (`devicePath`);--> statement-breakpoint
CREATE INDEX `CECDevice_deviceType_idx` ON `CECDevice` (`deviceType`);--> statement-breakpoint
CREATE INDEX `CECDevice_isActive_idx` ON `CECDevice` (`isActive`);--> statement-breakpoint
CREATE INDEX `CECCommandLog_cecDeviceId_timestamp_idx` ON `CECCommandLog` (`cecDeviceId`,`timestamp`);--> statement-breakpoint
CREATE INDEX `FireTVDevice_status_idx` ON `FireTVDevice` (`status`);--> statement-breakpoint
CREATE INDEX `FireTVDevice_lastSeen_idx` ON `FireTVDevice` (`lastSeen`);--> statement-breakpoint
CREATE INDEX `MatrixRoute_inputNum_idx` ON `MatrixRoute` (`inputNum`);--> statement-breakpoint
CREATE INDEX `MatrixRoute_isActive_idx` ON `MatrixRoute` (`isActive`);--> statement-breakpoint
CREATE INDEX `ScheduleLog_executedAt_idx` ON `ScheduleLog` (`executedAt`);--> statement-breakpoint
CREATE INDEX `ScheduleLog_scheduleId_idx` ON `ScheduleLog` (`scheduleId`);--> statement-breakpoint
CREATE INDEX `ScheduleLog_success_idx` ON `ScheduleLog` (`success`);--> statement-breakpoint
CREATE INDEX `Schedule_enabled_startTime_idx` ON `Schedule` (`enabled`,`startTime`);--> statement-breakpoint
CREATE INDEX `Schedule_deviceId_idx` ON `Schedule` (`deviceId`);--> statement-breakpoint
CREATE INDEX `SportsEvent_league_status_eventDate_idx` ON `SportsEvent` (`league`,`status`,`eventDate`);--> statement-breakpoint
CREATE INDEX `TestLog_testType_status_idx` ON `TestLog` (`testType`,`status`);