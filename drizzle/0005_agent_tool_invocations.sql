CREATE TABLE `agent_tool_invocations` (
	`id` text PRIMARY KEY NOT NULL,
	`tool` text NOT NULL,
	`args` text,
	`result_summary` text,
	`surface` text DEFAULT 'unknown' NOT NULL,
	`is_error` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_tool_invocations_tool_created_at_idx` ON `agent_tool_invocations` (`tool`,`created_at`);--> statement-breakpoint
CREATE INDEX `agent_tool_invocations_created_at_idx` ON `agent_tool_invocations` (`created_at`);