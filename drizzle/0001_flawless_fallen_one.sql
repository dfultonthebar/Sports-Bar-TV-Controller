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
CREATE INDEX `AtlasParameter_processorId_paramType_idx` ON `AtlasParameter` (`processorId`,`paramType`);