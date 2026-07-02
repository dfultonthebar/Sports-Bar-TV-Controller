CREATE TABLE `ObsbotCamera` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ipAddress` text NOT NULL,
	`viscaPort` integer DEFAULT 52381 NOT NULL,
	`rtspPort` integer DEFAULT 8554 NOT NULL,
	`rtspPath` text DEFAULT '/live' NOT NULL,
	`mediamtxPath` text,
	`status` text DEFAULT 'offline' NOT NULL,
	`lastSeenAt` text,
	`presets` text,
	`isActive` integer DEFAULT 1 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ObsbotCamera_ipAddress_idx` ON `ObsbotCamera` (`ipAddress`);