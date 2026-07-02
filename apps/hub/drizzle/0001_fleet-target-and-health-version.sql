CREATE TABLE `espn_cache` (
	`league_key` text PRIMARY KEY NOT NULL,
	`sport` text NOT NULL,
	`league` text NOT NULL,
	`games_json` text NOT NULL,
	`game_count` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fleet_target` (
	`id` integer PRIMARY KEY NOT NULL,
	`target_version` text NOT NULL,
	`target_sha` text,
	`set_by` text,
	`set_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fleet_update_events` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`run_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`result` text NOT NULL,
	`from_version` text,
	`to_version` text,
	`from_sha` text,
	`to_sha` text,
	`duration_secs` integer,
	`rollback_tag` text,
	`conflict_paths` text,
	`triggered_by` text,
	`error_message` text,
	`raw_payload` text
);
--> statement-breakpoint
CREATE INDEX `update_loc_ts` ON `fleet_update_events` (`location_id`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `update_dedup` ON `fleet_update_events` (`location_id`,`run_id`);--> statement-breakpoint
ALTER TABLE `health_snapshots` ADD `version` text;