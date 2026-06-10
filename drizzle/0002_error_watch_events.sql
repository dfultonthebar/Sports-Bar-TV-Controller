CREATE TABLE `error_watch_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`signature` text NOT NULL,
	`sample` text DEFAULT '' NOT NULL,
	`source_file` text,
	`detected_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `error_watch_events_detected_at_idx` ON `error_watch_events` (`detected_at`);--> statement-breakpoint
CREATE INDEX `error_watch_events_signature_idx` ON `error_watch_events` (`signature`,`detected_at`);--> statement-breakpoint
CREATE INDEX `error_watch_events_kind_idx` ON `error_watch_events` (`kind`,`detected_at`);