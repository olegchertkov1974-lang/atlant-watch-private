CREATE TABLE `sent_alerts` (
	`alert_id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`title` text NOT NULL,
	`sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watch_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
