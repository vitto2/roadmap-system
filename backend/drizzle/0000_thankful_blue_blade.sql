CREATE TABLE `topic_checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` integer NOT NULL,
	`key` text NOT NULL,
	`text` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_checklist_items_topic_key` ON `topic_checklist_items` (`topic_id`,`key`);--> statement-breakpoint
CREATE TABLE `checklist_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`checklist_item_id` integer NOT NULL,
	`checked_at` text NOT NULL,
	FOREIGN KEY (`checklist_item_id`) REFERENCES `topic_checklist_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checklist_progress_checklist_item_id_unique` ON `checklist_progress` (`checklist_item_id`);--> statement-breakpoint
CREATE TABLE `milestone_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`milestone_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `milestone_progress_milestone_id_unique` ON `milestone_progress` (`milestone_id`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`acceptance_criteria` text DEFAULT '[]' NOT NULL,
	`xp` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `milestones_project_key` ON `milestones` (`project_id`,`key`);--> statement-breakpoint
CREATE TABLE `project_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`repository_url` text,
	`deploy_url` text,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_progress_project_id_unique` ON `project_progress` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_topic` (
	`project_id` integer NOT NULL,
	`topic_id` integer NOT NULL,
	PRIMARY KEY(`project_id`, `topic_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`career_level` text NOT NULL,
	`difficulty` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` integer NOT NULL,
	`interval_days` integer NOT NULL,
	`due_on` text NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`studied_on` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`topic_id` integer,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `topic_prerequisites` (
	`topic_id` integer NOT NULL,
	`prerequisite_id` integer NOT NULL,
	PRIMARY KEY(`topic_id`, `prerequisite_id`),
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prerequisite_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `topic_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` integer NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`evidence_url` text,
	`started_at` text,
	`completed_at` text,
	`mastered_directly` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_progress_topic_id_unique` ON `topic_progress` (`topic_id`);--> statement-breakpoint
CREATE TABLE `topic_resources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` integer NOT NULL,
	`name` text NOT NULL,
	`url` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track_id` integer NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`career_level` text NOT NULL,
	`difficulty` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_slug_unique` ON `topics` (`slug`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_slug_unique` ON `tracks` (`slug`);