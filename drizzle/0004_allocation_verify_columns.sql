ALTER TABLE `input_source_allocations` ADD `verified_at` integer;--> statement-breakpoint
ALTER TABLE `input_source_allocations` ADD `verify_state` text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `input_source_allocations` ADD `verify_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `input_source_allocations` ADD `verify_error` text;