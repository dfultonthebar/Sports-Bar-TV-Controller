CREATE TABLE `AtlasMapping` (
	`id` text PRIMARY KEY NOT NULL,
	`processorId` text NOT NULL,
	`appKey` text NOT NULL,
	`atlasParam` text NOT NULL,
	`paramType` text NOT NULL,
	`paramCategory` text NOT NULL,
	`minValue` real,
	`maxValue` real,
	`minPercent` real,
	`maxPercent` real,
	`format` text DEFAULT 'val' NOT NULL,
	`description` text,
	`isReadOnly` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AtlasMapping_processorId_appKey_key` ON `AtlasMapping` (`processorId`,`appKey`);--> statement-breakpoint
CREATE INDEX `AtlasMapping_processorId_atlasParam_idx` ON `AtlasMapping` (`processorId`,`atlasParam`);--> statement-breakpoint
CREATE INDEX `AtlasMapping_paramType_idx` ON `AtlasMapping` (`paramType`);--> statement-breakpoint
CREATE TABLE `AtlasSubscription` (
	`id` text PRIMARY KEY NOT NULL,
	`processorId` text NOT NULL,
	`paramName` text NOT NULL,
	`format` text DEFAULT 'val' NOT NULL,
	`subscriptionType` text DEFAULT 'tcp' NOT NULL,
	`lastUpdate` text,
	`updateCount` integer DEFAULT 0 NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`processorId`) REFERENCES `AudioProcessor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AtlasSubscription_processorId_paramName_format_key` ON `AtlasSubscription` (`processorId`,`paramName`,`format`);--> statement-breakpoint
CREATE INDEX `AtlasSubscription_processorId_idx` ON `AtlasSubscription` (`processorId`);--> statement-breakpoint
CREATE INDEX `AtlasSubscription_isActive_idx` ON `AtlasSubscription` (`isActive`);