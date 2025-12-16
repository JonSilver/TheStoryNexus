import { attemptPromise } from "@jfdi/attempt";
import { and, eq } from "drizzle-orm";
import { Request, Response, Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { db } from "../db/client.js";
import { aiChats, chapters, lorebookEntries, sceneBeats, series, stories } from "../db/schema.js";

import type { InferSelectModel } from "drizzle-orm";

type ImportedChapter = InferSelectModel<typeof chapters>;
type ImportedLorebookEntry = InferSelectModel<typeof lorebookEntries>;
type ImportedSceneBeat = InferSelectModel<typeof sceneBeats>;
type ImportedAiChat = InferSelectModel<typeof aiChats>;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const seriesRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response) => {
    const [error] = await attemptPromise(() => fn(req, res));
    if (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message || "Server error" });
    }
};

// GET /series - List all series
seriesRouter.get(
    "/",
    asyncHandler(async (_, res) => {
        const allSeries = await db.select().from(series).orderBy(series.createdAt);
        res.json(allSeries);
    })
);

// GET /series/:id - Get single series
seriesRouter.get(
    "/:id",
    asyncHandler(async (req, res) => {
        const [result] = await db.select().from(series).where(eq(series.id, req.params.id));
        if (!result) {
            res.status(404).json({ error: "Series not found" });
            return;
        }
        res.json(result);
    })
);

// POST /series - Create series
seriesRouter.post(
    "/",
    asyncHandler(async (req, res) => {
        const newSeries = {
            id: nanoid(),
            name: req.body.name,
            description: req.body.description,
            createdAt: new Date(),
            isDemo: req.body.isDemo || false
        };
        await db.insert(series).values(newSeries);
        res.status(201).json(newSeries);
    })
);

// PUT /series/:id - Update series
seriesRouter.put(
    "/:id",
    asyncHandler(async (req, res) => {
        const updated = {
            name: req.body.name,
            description: req.body.description
        };
        const result = await db.update(series).set(updated).where(eq(series.id, req.params.id)).returning();
        const updatedSeries = Array.isArray(result) ? result[0] : result;
        if (!updatedSeries) {
            res.status(404).json({ error: "Series not found" });
            return;
        }
        res.json(updatedSeries);
    })
);

// DELETE /series/:id - Delete series with cascade
seriesRouter.delete(
    "/:id",
    asyncHandler(async (req, res) => {
        const seriesId = req.params.id;

        // 1. Orphan all stories in this series (set seriesId to null)
        await db.update(stories).set({ seriesId: null }).where(eq(stories.seriesId, seriesId));

        // 2. Delete all series-level lorebook entries
        await db
            .delete(lorebookEntries)
            .where(and(eq(lorebookEntries.level, "series"), eq(lorebookEntries.scopeId, seriesId)));

        // 3. Delete the series itself
        await db.delete(series).where(eq(series.id, seriesId));

        res.json({ success: true });
    })
);

// GET /series/:id/stories - Get all stories in series
seriesRouter.get(
    "/:id/stories",
    asyncHandler(async (req, res) => {
        const seriesStories = await db
            .select()
            .from(stories)
            .where(eq(stories.seriesId, req.params.id))
            .orderBy(stories.createdAt);
        res.json(seriesStories);
    })
);

// GET /series/:id/lorebook - Get all series-level lorebook entries
seriesRouter.get(
    "/:id/lorebook",
    asyncHandler(async (req, res) => {
        const entries = await db
            .select()
            .from(lorebookEntries)
            .where(and(eq(lorebookEntries.level, "series"), eq(lorebookEntries.scopeId, req.params.id)))
            .orderBy(lorebookEntries.createdAt);
        res.json(entries);
    })
);

// GET /series/:id/export - Export series with all stories and lorebook
seriesRouter.get(
    "/:id/export",
    asyncHandler(async (req, res) => {
        const seriesId = req.params.id;

        const [seriesResult] = await db.select().from(series).where(eq(series.id, seriesId));
        if (!seriesResult) {
            res.status(404).json({ error: "Series not found" });
            return;
        }

        // Fetch series-level lorebook entries
        const seriesLorebook = await db
            .select()
            .from(lorebookEntries)
            .where(and(eq(lorebookEntries.level, "series"), eq(lorebookEntries.scopeId, seriesId)));

        // Fetch all stories in series
        const seriesStories = await db.select().from(stories).where(eq(stories.seriesId, seriesId));

        // Export each story with full data
        const storyExports = await Promise.all(
            seriesStories.map(async story => {
                const [storyChapters, storyLorebook, storySceneBeats, storyAiChats] = await Promise.all([
                    db.select().from(chapters).where(eq(chapters.storyId, story.id)),
                    db
                        .select()
                        .from(lorebookEntries)
                        .where(and(eq(lorebookEntries.level, "story"), eq(lorebookEntries.scopeId, story.id))),
                    db.select().from(sceneBeats).where(eq(sceneBeats.storyId, story.id)),
                    db.select().from(aiChats).where(eq(aiChats.storyId, story.id))
                ]);

                return {
                    version: "1.0",
                    type: "story",
                    exportDate: new Date().toISOString(),
                    story,
                    series: seriesResult,
                    chapters: storyChapters,
                    lorebookEntries: storyLorebook,
                    sceneBeats: storySceneBeats,
                    aiChats: storyAiChats
                };
            })
        );

        const exportData = {
            version: "1.0",
            type: "series",
            exportDate: new Date().toISOString(),
            series: seriesResult,
            lorebookEntries: seriesLorebook,
            stories: storyExports
        };

        res.json(exportData);
    })
);

// POST /series/import - Import series with all stories
seriesRouter.post(
    "/import",
    upload.single("file"),
    asyncHandler(async (req, res) => {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        const fileBuffer = req.file.buffer;
        const [parseError, seriesData] = await attemptPromise(() =>
            Promise.resolve(JSON.parse(fileBuffer.toString("utf-8")))
        );

        if (parseError) {
            res.status(400).json({ error: "Invalid JSON file", details: parseError.message });
            return;
        }

        if (!seriesData.type || seriesData.type !== "series" || !seriesData.series) {
            res.status(400).json({ error: "Invalid series data format" });
            return;
        }

        const newSeriesId = nanoid();

        // Create new series
        const newSeries = {
            ...seriesData.series,
            id: newSeriesId,
            name: `${seriesData.series.name} (Imported)`,
            createdAt: new Date()
        };
        await db.insert(series).values(newSeries);

        // Import series-level lorebook entries
        if (seriesData.lorebookEntries?.length) {
            const newEntries = seriesData.lorebookEntries
                .map((entry: ImportedLorebookEntry) => {
                    // Validate entry
                    if (entry.level && entry.level !== "series") {
                        console.warn(`Skipping non-series entry ${entry.name}`);
                        return null;
                    }

                    return {
                        ...entry,
                        id: nanoid(),
                        level: "series",
                        scopeId: newSeriesId,
                        storyId: "", // Temporary for Phase 1
                        createdAt: new Date()
                    };
                })
                .filter((entry: ImportedLorebookEntry): entry is NonNullable<typeof entry> => entry !== null);

            if (newEntries.length > 0) await db.insert(lorebookEntries).values(newEntries);
        }

        // Import stories
        const importedStoryIds = [];
        for (const storyExport of seriesData.stories || []) {
            const newStoryId = nanoid();
            importedStoryIds.push(newStoryId);

            const newStory = {
                ...storyExport.story,
                id: newStoryId,
                seriesId: newSeriesId,
                createdAt: new Date()
            };
            await db.insert(stories).values(newStory);

            // Import chapters
            if (storyExport.chapters?.length) {
                const newChapters = storyExport.chapters.map((chapter: ImportedChapter) => ({
                    ...chapter,
                    id: nanoid(),
                    storyId: newStoryId,
                    createdAt: new Date()
                }));
                await db.insert(chapters).values(newChapters);
            }

            // Import story-level lorebook entries
            if (storyExport.lorebookEntries?.length) {
                const newEntries = storyExport.lorebookEntries
                    .map((entry: ImportedLorebookEntry) => ({
                        ...entry,
                        id: nanoid(),
                        level: "story",
                        scopeId: newStoryId,
                        storyId: newStoryId, // Temporary for Phase 1
                        createdAt: new Date()
                    }))
                    .filter((entry: ImportedLorebookEntry): entry is NonNullable<typeof entry> => entry !== null);

                if (newEntries.length > 0) await db.insert(lorebookEntries).values(newEntries);
            }

            // Import scene beats
            if (storyExport.sceneBeats?.length) {
                const newSceneBeats = storyExport.sceneBeats.map((sceneBeat: ImportedSceneBeat) => ({
                    ...sceneBeat,
                    id: nanoid(),
                    storyId: newStoryId,
                    createdAt: new Date()
                }));
                await db.insert(sceneBeats).values(newSceneBeats);
            }

            // Import AI chats
            if (storyExport.aiChats?.length) {
                const newChats = storyExport.aiChats.map((chat: ImportedAiChat) => ({
                    ...chat,
                    id: nanoid(),
                    storyId: newStoryId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }));
                await db.insert(aiChats).values(newChats);
            }
        }

        res.json({
            success: true,
            seriesId: newSeriesId,
            imported: {
                stories: importedStoryIds.length,
                lorebookEntries: seriesData.lorebookEntries?.length || 0
            }
        });
    })
);

export default seriesRouter;
