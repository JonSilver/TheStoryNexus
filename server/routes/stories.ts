import { attemptPromise } from "@jfdi/attempt";
import type { InferSelectModel } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import multer from "multer";
import { db, schema } from "../db/client.js";
import { createCrudRouter } from "../lib/crud.js";
import { generateEpub } from "../services/epubGenerator.js";

type ImportedChapter = InferSelectModel<typeof schema.chapters>;
type ImportedLorebookEntry = InferSelectModel<typeof schema.lorebookEntries>;
type ImportedSceneBeat = InferSelectModel<typeof schema.sceneBeats>;
type ImportedAiChat = InferSelectModel<typeof schema.aiChats>;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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
                    const [story] = await db.select().from(schema.stories).where(eq(schema.stories.id, storyId));
                    if (!story) throw new Error("Story not found");

                    // Fetch series if story belongs to one
                    let seriesData;
                    if (story.seriesId) {
                        const [seriesResult] = await db
                            .select()
                            .from(schema.series)
                            .where(eq(schema.series.id, story.seriesId));
                        if (seriesResult) seriesData = seriesResult;
                    }

                    // Fetch story-level lorebook entries only (not inherited ones)
                    const lorebookEntries = await db
                        .select()
                        .from(schema.lorebookEntries)
                        .where(
                            and(eq(schema.lorebookEntries.level, "story"), eq(schema.lorebookEntries.scopeId, storyId))
                        );

                    const [chapters, sceneBeats, aiChats] = await Promise.all([
                        db.select().from(schema.chapters).where(eq(schema.chapters.storyId, storyId)),
                        db.select().from(schema.sceneBeats).where(eq(schema.sceneBeats.storyId, storyId)),
                        db.select().from(schema.aiChats).where(eq(schema.aiChats.storyId, storyId))
                    ]);

                    return {
                        version: "1.0",
                        type: "story",
                        exportDate: new Date().toISOString(),
                        story,
                        series: seriesData,
                        chapters,
                        lorebookEntries,
                        sceneBeats,
                        aiChats
                    };
                });

                if (error) {
                    console.error("Error exporting story:", error);
                    if (error.message === "Story not found") res.status(404).json({ error: error.message });
                    else res.status(500).json({ error: "Failed to export story", details: error.message });

                    return;
                }

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

                const [error, newStoryId] = await attemptPromise(async () => {
                    const newStoryId = crypto.randomUUID();
                    const idMap = new Map<string, string>();
                    idMap.set(storyData.story.id, newStoryId);

                    const newStory = {
                        ...storyData.story,
                        id: newStoryId,
                        createdAt: new Date(),
                        title: `${storyData.story.title} (Imported)`,
                        seriesId: undefined // Don't import series relationship - user must manually assign
                    };

                    await db.insert(schema.stories).values(newStory);

                    if (storyData.chapters?.length) {
                        const newChapters = storyData.chapters.map((chapter: ImportedChapter) => {
                            const newChapterId = crypto.randomUUID();
                            idMap.set(chapter.id, newChapterId);
                            return {
                                ...chapter,
                                id: newChapterId,
                                storyId: newStoryId,
                                createdAt: new Date()
                            };
                        });
                        await db.insert(schema.chapters).values(newChapters);
                    }

                    if (storyData.lorebookEntries?.length) {
                        const newEntries = storyData.lorebookEntries
                            .map((entry: ImportedLorebookEntry) => {
                                // Validate level/scopeId constraints
                                if (entry.level === "global" && entry.scopeId) {
                                    console.warn(
                                        `Skipping invalid entry ${entry.name}: global entries cannot have scopeId`
                                    );
                                    return null;
                                }
                                if ((entry.level === "series" || entry.level === "story") && !entry.scopeId) {
                                    console.warn(
                                        `Skipping invalid entry ${entry.name}: ${entry.level} entries require scopeId`
                                    );
                                    return null;
                                }
                                if (entry.level && !["global", "series", "story"].includes(entry.level)) {
                                    console.warn(`Skipping invalid entry ${entry.name}: invalid level ${entry.level}`);
                                    return null;
                                }

                                const newEntryId = crypto.randomUUID();
                                idMap.set(entry.id, newEntryId);
                                return {
                                    ...entry,
                                    id: newEntryId,
                                    level: "story", // Force to story level on import
                                    scopeId: newStoryId, // Assign to new story
                                    storyId: newStoryId, // Temporary for Phase 1
                                    createdAt: new Date()
                                };
                            })
                            .filter(
                                (entry: ImportedLorebookEntry): entry is NonNullable<typeof entry> => entry !== null
                            );

                        if (newEntries.length > 0) await db.insert(schema.lorebookEntries).values(newEntries);
                    }

                    if (storyData.sceneBeats?.length) {
                        const newSceneBeats = storyData.sceneBeats.map((sceneBeat: ImportedSceneBeat) => {
                            const newSceneBeatId = crypto.randomUUID();
                            return {
                                ...sceneBeat,
                                id: newSceneBeatId,
                                storyId: newStoryId,
                                chapterId: idMap.get(sceneBeat.chapterId) || sceneBeat.chapterId,
                                createdAt: new Date()
                            };
                        });
                        await db.insert(schema.sceneBeats).values(newSceneBeats);
                    }

                    if (storyData.aiChats?.length) {
                        const newChats = storyData.aiChats.map((chat: ImportedAiChat) => {
                            const newChatId = crypto.randomUUID();
                            return {
                                ...chat,
                                id: newChatId,
                                storyId: newStoryId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            };
                        });
                        await db.insert(schema.aiChats).values(newChats);
                    }

                    return newStoryId;
                });

                if (error) {
                    console.error("Error importing story:", error);
                    res.status(500).json({ error: "Failed to import story", details: error.message });
                    return;
                }

                res.json({
                    success: true,
                    storyId: newStoryId,
                    imported: {
                        chapters: storyData.chapters?.length || 0,
                        lorebookEntries: storyData.lorebookEntries?.length || 0,
                        sceneBeats: storyData.sceneBeats?.length || 0,
                        aiChats: storyData.aiChats?.length || 0
                    }
                });
            })
        );

        // Delete story with lorebook cascade
        router.delete(
            "/:id",
            asyncHandler(async (req, res) => {
                const storyId = req.params.id;

                await db.transaction(async tx => {
                    // 1. Delete story-level lorebook entries
                    await tx
                        .delete(schema.lorebookEntries)
                        .where(
                            and(eq(schema.lorebookEntries.level, "story"), eq(schema.lorebookEntries.scopeId, storyId))
                        );

                    // 2. Delete story (FK cascades handle chapters, aiChats, notes, etc.)
                    await tx.delete(schema.stories).where(eq(schema.stories.id, storyId));
                });

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
