CREATE TABLE IF NOT EXISTS `error_events` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`source` text NOT NULL,
	`signature` text NOT NULL,
	`severity` text NOT NULL,
	`sample` text,
	`raw_payload` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `error_loc_ts` ON `error_events` (`location_id`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `error_dedup` ON `error_events` (`location_id`,`source`,`signature`,`occurred_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `health_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`ts` integer NOT NULL,
	`overall_status` text NOT NULL,
	`http_status` integer,
	`devices_online` integer,
	`devices_total` integer,
	`error_rate` real,
	`raw_payload` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `health_loc_ts` ON `health_snapshots` (`location_id`,`ts`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `hub_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`branch` text,
	`timezone` text,
	`tailscale_host` text,
	`hmac_secret` text NOT NULL,
	`last_seen_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `metrics_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`ts` integer NOT NULL,
	`cpu_usage_pct` real,
	`mem_used_pct` real,
	`disk_used_pct` real,
	`uptime_sec` real,
	`raw_payload` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `metrics_loc_ts` ON `metrics_snapshots` (`location_id`,`ts`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `scheduler_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`ts` integer NOT NULL,
	`is_running` integer,
	`success_rate` real,
	`total_ops` integer,
	`error_count` integer,
	`raw_payload` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `scheduler_loc_ts` ON `scheduler_snapshots` (`location_id`,`ts`);