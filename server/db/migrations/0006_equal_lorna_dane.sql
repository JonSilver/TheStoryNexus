CREATE TABLE `actionOverrides` (
	`id` text PRIMARY KEY NOT NULL,
	`actionId` text NOT NULL,
	`storyId` text,
	`template` text,
	`temperature` real,
	`maxTokens` integer,
	`topP` real,
	`modelRef` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`storyId`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `action_override_action_idx` ON `actionOverrides` (`actionId`);--> statement-breakpoint
CREATE INDEX `action_override_story_idx` ON `actionOverrides` (`storyId`);--> statement-breakpoint
ALTER TABLE `aiSettings` ADD `defaultProvider` text;--> statement-breakpoint
ALTER TABLE `aiSettings` ADD `defaultModelId` text;