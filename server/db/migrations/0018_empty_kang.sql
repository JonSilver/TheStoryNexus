CREATE TABLE `transpositions` (
	`id` text PRIMARY KEY NOT NULL,
	`storyId` text NOT NULL,
	`sourceStoryId` text,
	`target` text NOT NULL,
	`brief` text,
	`stage` text DEFAULT 'brief' NOT NULL,
	`state` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`storyId`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sourceStoryId`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transpositions_storyId_unique` ON `transpositions` (`storyId`);