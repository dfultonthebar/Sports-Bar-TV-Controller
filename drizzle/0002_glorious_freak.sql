CREATE TABLE `N8nWebhookLog` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`workflowId` text,
	`executionId` text,
	`payload` text NOT NULL,
	`response` text,
	`status` text DEFAULT 'success' NOT NULL,
	`errorMessage` text,
	`duration` integer NOT NULL,
	`metadata` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `N8nWebhookLog_action_idx` ON `N8nWebhookLog` (`action`);--> statement-breakpoint
CREATE INDEX `N8nWebhookLog_status_idx` ON `N8nWebhookLog` (`status`);--> statement-breakpoint
CREATE INDEX `N8nWebhookLog_createdAt_idx` ON `N8nWebhookLog` (`createdAt`);--> statement-breakpoint
CREATE INDEX `N8nWebhookLog_workflowId_idx` ON `N8nWebhookLog` (`workflowId`);--> statement-breakpoint
CREATE TABLE `N8nWorkflowConfig` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`workflowId` text,
	`description` text,
	`webhookUrl` text,
	`isActive` integer DEFAULT true NOT NULL,
	`triggerType` text DEFAULT 'manual' NOT NULL,
	`schedule` text,
	`actions` text NOT NULL,
	`metadata` text,
	`lastExecuted` text,
	`executionCount` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `N8nWorkflowConfig_workflowId_unique` ON `N8nWorkflowConfig` (`workflowId`);--> statement-breakpoint
CREATE INDEX `N8nWorkflowConfig_workflowId_idx` ON `N8nWorkflowConfig` (`workflowId`);--> statement-breakpoint
CREATE INDEX `N8nWorkflowConfig_isActive_idx` ON `N8nWorkflowConfig` (`isActive`);