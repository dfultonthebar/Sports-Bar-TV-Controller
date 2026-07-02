CREATE TABLE `rollout_boxes` (
	`id` text PRIMARY KEY NOT NULL,
	`rollout_id` text NOT NULL,
	`location_id` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`triggered_at` integer,
	`resolved_at` integer,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `rollout_boxes_rollout` ON `rollout_boxes` (`rollout_id`);--> statement-breakpoint
CREATE TABLE `rollouts` (
	`id` text PRIMARY KEY NOT NULL,
	`target_version` text NOT NULL,
	`target_sha` text,
	`canary_location_id` text NOT NULL,
	`min_soak_minutes` integer DEFAULT 30 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`canary_triggered_at` integer,
	`canary_success_at` integer,
	`wave_triggered_at` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
