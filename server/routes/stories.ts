import { attemptPromise } from "@jfdi/attempt";
import { and, eq } from "drizzle-orm";
import multer from "multer";
import { db, schema } from "../db/client.js";
import { createCrudRouter } from "../lib/crud.js";
import { deleteStoryAssets } from "../services/assets/storage.js";
import { generateEpub } from "../services/epubGenerator.js";
import { exportStoryBackup, restoreStory } from "../services/stories/backup.js";
import type { StoryBackup } from "../services/stories/portable.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 250 * 1024 * 1024 } });

export default createCrudRouter({
    table: schema.stories,
    name: "Story",
    customRoutes: (router, { asyncHandler }) => {
        // Export a single story with all related data
        router.get(
            "/:id/export",
            asyncHandler(async (req, res) => {
                const storyId = req.params.id;

                const [error, data] = await attemptPromise(async () => {
                    const backup = await exportStoryBackup(storyId);
                    if (!backup) throw new Error("Story not found");
                    return backup;
                });

                if (error) {
                    console.error("Error exporting story:", error);
                    if (error.message === "Story not found") res.status(404).json({ error: error.message });
                    else res.status(500).json({ error: "Failed to export story", details: error.message });

                    return;
                }

                // Browsers hitting this via <a download> need a filename
                res.setHeader(
                    "Content-Disposition",
                    `attachment; filename="${data.story.title.replace(/[^\w-]+/g, "-")}.story.json"`
                );
                res.json(data);
            })
        );

        // Import a story from JSON
        router.post(
            "/import",
            upload.single("file"),
            asyncHandler(async (req, res) => {
                if (!req.file) {
                    res.status(400).json({ error: "No file uploaded" });
                    return;
                }

                const fileBuffer = req.file.buffer;
                const [parseError, storyData] = await attemptPromise(() =>
                    Promise.resolve(JSON.parse(fileBuffer.toString("utf-8")))
                );

                if (parseError) {
                    res.status(400).json({ error: "Invalid JSON file", details: parseError.message });
                    return;
                }

                if (!storyData.type || storyData.type !== "story" || !storyData.story) {
                    res.status(400).json({ error: "Invalid story data format" });
                    return;
                }

                // All-or-nothing: a half-restored backup is worse than none
                const [error, restored] = await attemptPromise(() => restoreStory(storyData as StoryBackup));
                if (error) {
                    console.error("Error importing story:", error);
                    res.status(500).json({ error: "Failed to import story", details: error.message });
                    return;
                }
                res.json(restored);
            })
        );

        // An independent copy, carrying exactly what a backup carries — and, unlike a restore, its series
        router.post(
            "/:id/duplicate",
            asyncHandler(async (req, res) => {
                const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
                const backup = await exportStoryBackup(req.params.id);
                if (!backup) {
                    res.status(404).json({ error: "Story not found" });
                    return;
                }
                const [error, copy] = await attemptPromise(() =>
                    restoreStory(backup, {
                        seriesId: backup.story.seriesId,
                        titleSuffix: " (copy)",
                        ...(title && { title })
                    })
                );
                if (error) {
                    console.error("Error duplicating story:", error);
                    res.status(500).json({ error: "Couldn't duplicate the story", details: error.message });
                    return;
                }
                res.json(copy);
            })
        );

        // Delete story with lorebook cascade
        router.delete(
            "/:id",
            asyncHandler(async (req, res) => {
                const storyId = req.params.id;

                // better-sqlite3 transactions are synchronous — an async callback
                // makes drizzle throw AFTER the statements have run, turning an
                // atomic delete into a 500 with side effects
                db.transaction(tx => {
                    // 1. Delete story-level lorebook entries
                    tx.delete(schema.lorebookEntries)
                        .where(
                            and(eq(schema.lorebookEntries.level, "story"), eq(schema.lorebookEntries.scopeId, storyId))
                        )
                        .run();

                    // 2. Delete story (FK cascades handle chapters, aiChats, notes, etc.)
                    tx.delete(schema.stories).where(eq(schema.stories.id, storyId)).run();
                });

                // Assets go after the transaction: a DB failure must not leave
                // a live story whose images are already destroyed. A filesystem
                // failure here just logs — the orphan sweep can collect later.
                const [assetError] = await attemptPromise(() => deleteStoryAssets(storyId));
                if (assetError) console.error(`Failed to delete assets for story ${storyId}:`, assetError);

                res.status(204).send();
            })
        );

        // Export story as EPUB
        router.get(
            "/:id/epub",
            asyncHandler(async (req, res) => {
                const storyId = req.params.id;

                const [error, epubBuffer] = await attemptPromise(async () => {
                    const [story] = await db.select().from(schema.stories).where(eq(schema.stories.id, storyId));
                    if (!story) throw new Error("Story not found");

                    const chapters = await db
                        .select()
                        .from(schema.chapters)
                        .where(eq(schema.chapters.storyId, storyId))
                        .orderBy(schema.chapters.order);

                    return await generateEpub(story, chapters);
                });

                if (error) {
                    console.error("Error generating EPUB:", error);
                    if (error.message === "Story not found") res.status(404).json({ error: error.message });
                    else res.status(500).json({ error: "Failed to generate EPUB", details: error.message });
                    return;
                }

                res.setHeader("Content-Type", "application/epub+zip");
                res.setHeader("Content-Disposition", `attachment; filename="${req.params.id}.epub"`);
                res.send(epubBuffer);
            })
        );
    }
});
