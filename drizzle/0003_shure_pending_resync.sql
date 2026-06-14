CREATE TABLE `shure_pending_resync` (
	`id` text PRIMARY KEY NOT NULL,
	`receiver_id` text NOT NULL,
	`channel` integer NOT NULL,
	`old_freq_khz` integer NOT NULL,
	`new_freq_khz` integer NOT NULL,
	`set_at` integer NOT NULL,
	`verified_at` integer,
	`canceled_at` integer,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `shure_pending_resync_active_idx` ON `shure_pending_resync` (`receiver_id`,`channel`,`verified_at`,`canceled_at`);--> statement-breakpoint
CREATE INDEX `shure_pending_resync_set_at_idx` ON `shure_pending_resync` (`set_at`);