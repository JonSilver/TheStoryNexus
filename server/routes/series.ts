import { attemptPromise } from "@jfdi/attempt";
import { and, eq } from "drizzle-orm";
import { type Request, type Response, Router } from "express";
import multer from "multer";
import { db } from "../db/client.js";
import { lorebookEntries, series, stories } from "../db/schema.js";
import { writeStoryAssets } from "../services/assets/storage.js";
import { commitSeriesImport, exportSeriesBackup } from "../services/stories/backup.js";
import { type SeriesBackup, buildSeriesImport } from "../services/stories/portable.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

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
            id: crypto.randomUUID(),
            name: req.body.name,
            description: req.body.description,
            createdAt: new Date(),
            // Internal flag — only demo seeding sets it, never a request body
            isDemo: false
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

// GET /series/:id/export - Export series with its bible and complete member-story backups
seriesRouter.get(
    "/:id/export",
    asyncHandler(async (req, res) => {
        const backup = await exportSeriesBackup(req.params.id);
        if (!backup) {
            res.status(404).json({ error: "Series not found" });
            return;
        }
        // Browsers hitting this via <a download> need a filename
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${backup.series.name.replace(/[^\w-]+/g, "-")}.series.json"`
        );
        res.json(backup);
    })
);

// POST /series/import - Import series with all stories, atomically
seriesRouter.post(
    "/import",
    upload.single("file"),
    asyncHandler(async (req, res) => {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        const [parseError, seriesData] = await attemptPromise(() =>
            Promise.resolve(JSON.parse(req.file!.buffer.toString("utf-8")))
        );
        if (parseError) {
            res.status(400).json({ error: "Invalid JSON file", details: parseError.message });
            return;
        }
        if (seriesData?.type !== "series" || !seriesData.series || typeof seriesData.series.name !== "string") {
            res.status(400).json({ error: "Invalid series data format" });
            return;
        }

        const newSeriesId = crypto.randomUUID();
        const rows = buildSeriesImport(seriesData as SeriesBackup, newSeriesId, () => crypto.randomUUID(), new Date());

        const [error] = await attemptPromise(async () => commitSeriesImport(rows));
        if (error) {
            console.error("Error importing series:", error);
            res.status(500).json({ error: "Failed to import series — nothing was created", details: error.message });
            return;
        }

        const assetsFailed: string[] = [];
        for (const story of rows.stories)
            assetsFailed.push(...(await writeStoryAssets(story.rows.story.id, story.assets)));

        res.json({
            success: true,
            seriesId: newSeriesId,
            imported: { stories: rows.stories.length, lorebookEntries: rows.lorebookEntries.length },
            assetsFailed
        });
    })
);

export default seriesRouter;
