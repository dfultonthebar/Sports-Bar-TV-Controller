PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_InterferenceAttribution` (
	`id` text PRIMARY KEY NOT NULL,
	`rf_event_id` text NOT NULL,
	`neighborhood_event_id` text NOT NULL,
	`time_delta_seconds` integer NOT NULL,
	`distance_mi` real NOT NULL,
	`confidence` real NOT NULL,
	`attribution_method` text DEFAULT 'correlation_v1' NOT NULL,
	`source` text DEFAULT 'shure' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`neighborhood_event_id`) REFERENCES `NeighborhoodEvent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_InterferenceAttribution`("id", "rf_event_id", "neighborhood_event_id", "time_delta_seconds", "distance_mi", "confidence", "attribution_method", "source", "created_at") SELECT "id", "rf_event_id", "neighborhood_event_id", "time_delta_seconds", "distance_mi", "confidence", "attribution_method", "source", "created_at" FROM `InterferenceAttribution`;--> statement-breakpoint
DROP TABLE `InterferenceAttribution`;--> statement-breakpoint
ALTER TABLE `__new_InterferenceAttribution` RENAME TO `InterferenceAttribution`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `InterferenceAttribution_rfEvent_idx` ON `InterferenceAttribution` (`rf_event_id`);--> statement-breakpoint
CREATE INDEX `InterferenceAttribution_neighborhoodEvent_idx` ON `InterferenceAttribution` (`neighborhood_event_id`);--> statement-breakpoint
CREATE INDEX `InterferenceAttribution_source_idx` ON `InterferenceAttribution` (`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `InterferenceAttribution_rfEvent_neighborhoodEvent_unique` ON `InterferenceAttribution` (`rf_event_id`,`neighborhood_event_id`);