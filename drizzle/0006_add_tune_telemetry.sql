CREATE TABLE IF NOT EXISTS `TrainingDocument` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`fileType` text DEFAULT 'md' NOT NULL,
	`fileName` text,
	`filePath` text,
	`fileSize` integer,
	`category` text,
	`tags` text,
	`description` text,
	`metadata` text,
	`processedAt` text,
	`viewCount` integer DEFAULT 0 NOT NULL,
	`lastViewed` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `input_source_allocations` ADD `tune_success` integer;--> statement-breakpoint
ALTER TABLE `input_source_allocations` ADD `tune_error` text;--> statement-breakpoint
ALTER TABLE `input_source_allocations` ADD `tune_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `input_source_allocations` ADD `tune_last_attempt_at` integer;