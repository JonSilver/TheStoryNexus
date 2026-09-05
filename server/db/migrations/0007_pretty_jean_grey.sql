ALTER TABLE `chapters` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `chapters` ADD `updatedAt` integer;--> statement-breakpoint
ALTER TABLE `chapters` ADD `summarySourceRevision` integer;