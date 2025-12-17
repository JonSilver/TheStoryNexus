import { attemptPromise } from "@jfdi/attempt";
import { and, eq, or } from "drizzle-orm";
import multer from "multer";
import { nanoid } from "nanoid";
import { db, schema } from "../db/client.js";
import { createCrudRouter } from "../lib/crud.js";
import { parseJson } from "../lib/json.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

type LorebookRow = typeof schema.lorebookEntries.$inferSelect;

interface TransformedLorebookEntry extends Omit<LorebookRow, "tags" | "metadata"> {
    tags: unknown;
    metadata: unknown;
}

const transform = (entry: LorebookRow): TransformedLorebookEntry => ({
    ...entry,
    tags: parseJson(entry.tags as string),
    metadata: parseJson(entry.metadata as string | null | undefined)
});

export default createCrudRouter({
    table: schema.lorebookEntries,
    name: "Lorebook entry",
    transforms: { afterRead: transform },
    customRoutes: (router, { asyncHandler, table }) => {
        // Level-based query endpoints

        // GET /lorebook/global - Get all global entries
        router.get(
            "/global",
            asyncHandler(async (_, res) => {
                const entries = await db.select().from(table).where(eq(table.level, "global")).orderBy(table.createdAt);
                res.json(entries.map(transform));
            })
        );

        // GET /lorebook/series/:seriesId - Get series-level entries
        router.get(
            "/series/:seriesId",
            asyncHandler(async (req, res) => {
                const entries = await db
                    .select()
                    .from(table)
                    .where(and(eq(table.level, "series"), eq(table.scopeId, req.params.seriesId)))
                    .orderBy(table.createdAt);
                res.json(entries.map(transform));
            })
        );

        // GET /lorebook/story/:storyId/hierarchical - CRITICAL: Get global + series + story entries
        router.get(
            "/story/:storyId/hierarchical",
            asyncHandler(async (req, res) => {
                const storyId = req.params.storyId;

                // Fetch the story to check if it belongs to a series
                const storyResult = await db.select().from(schema.stories).where(eq(schema.stories.id, storyId));
                if (storyResult.length === 0) {
                    res.status(404).json({ error: "Story not found" });
                    return;
                }
                const story = storyResult[0];

                // Build query conditions: global + story-level, optionally + series-level
                const conditions = [
                    eq(table.level, "global"),
                    and(eq(table.level, "story"), eq(table.scopeId, storyId))
                ];

                if (story.seriesId) conditions.push(and(eq(table.level, "series"), eq(table.scopeId, story.seriesId)));

                // Execute unified query
                const entries = await db
                    .select()
                    .from(table)
                    .where(or(...conditions))
                    .orderBy(table.level, table.createdAt);

                res.json(entries.map(transform));
            })
        );

        // GET /lorebook/story/:storyId - Get story-level entries only (must come after hierarchical route)
        router.get(
            "/story/:storyId",
            asyncHandler(async (req, res) => {
                const entries = await db
                    .select()
                    .from(table)
                    .where(and(eq(table.level, "story"), eq(table.scopeId, req.params.storyId)))
                    .orderBy(table.createdAt);
                res.json(entries.map(transform));
            })
        );

        // Existing category and tag routes (using level/scopeId now)
        router.get(
            "/story/:storyId/category/:category",
            asyncHandler(async (req, res) => {
                const rows = await db
                    .select()
                    .from(table)
                    .where(
                        and(
                            eq(table.level, "story"),
                            eq(table.scopeId, req.params.storyId),
                            eq(table.category, req.params.category)
                        )
                    );
                res.json(rows.map(transform));
            })
        );

        router.get(
            "/story/:storyId/tag/:tag",
            asyncHandler(async (req, res) => {
                const rows = await db
                    .select()
                    .from(table)
                    .where(and(eq(table.level, "story"), eq(table.scopeId, req.params.storyId)));
                const filtered = rows
                    .map(transform)
                    .filter(entry => Array.isArray(entry.tags) && entry.tags.includes(req.params.tag));
                res.json(filtered);
            })
        );

        // Custom POST with validation
        router.post(
            "/",
            asyncHandler(async (req, res) => {
                const { level, scopeId, name, description, category, tags, metadata, isDisabled, isDemo } = req.body;

                // Validate level/scopeId constraints
                if (level === "global" && scopeId) {
                    res.status(400).json({ error: "Global entries cannot have scopeId" });
                    return;
                }
                if ((level === "series" || level === "story") && !scopeId) {
                    res.status(400).json({ error: `${level} entries require scopeId` });
                    return;
                }

                const newEntry = {
                    id: req.body.id || crypto.randomUUID(),
                    level: level || "story",
                    scopeId: scopeId || null,
                    name,
                    description,
                    category,
                    tags: JSON.stringify(tags),
                    metadata: metadata ? JSON.stringify(metadata) : null,
                    isDisabled: isDisabled || false,
                    createdAt: new Date(),
                    isDemo: isDemo || false
                };

                const result = await db.insert(table).values(newEntry).returning();
                const created = Array.isArray(result) ? result[0] : result;
                res.status(201).json(transform(created));
            })
        );

        // Custom PUT with validation
        router.put(
            "/:id",
            asyncHandler(async (req, res) => {
                const { level, scopeId } = req.body;

                // Validate level/scopeId constraints if they're being updated
                if (level !== undefined) {
                    if (level === "global" && scopeId) {
                        res.status(400).json({ error: "Global entries cannot have scopeId" });
                        return;
                    }
                    if ((level === "series" || level === "story") && !scopeId) {
                        res.status(400).json({ error: `${level} entries require scopeId` });
                        return;
                    }
                }

                const { id: _id, createdAt: _createdAt, ...updates } = req.body;

                const result = await db.update(table).set(updates).where(eq(table.id, req.params.id)).returning();
                const updated = Array.isArray(result) ? result[0] : result;
                if (!updated) {
                    res.status(404).json({ error: "Lorebook entry not found" });
                    return;
                }
                res.json(transform(updated));
            })
        );

        // GET /lorebook/global/export - Export all global lorebook entries
        router.get(
            "/global/export",
            asyncHandler(async (_, res) => {
                const entries = await db.select().from(table).where(eq(table.level, "global")).orderBy(table.createdAt);

                const exportData = {
                    version: "1.0",
                    type: "global-lorebook",
                    exportDate: new Date().toISOString(),
                    lorebookEntries: entries.map(transform)
                };

                res.json(exportData);
            })
        );

        // POST /lorebook/global/import - Import global lorebook entries
        router.post(
            "/global/import",
            upload.single("file"),
            asyncHandler(async (req, res) => {
                if (!req.file) {
                    res.status(400).json({ error: "No file uploaded" });
                    return;
                }

                const fileBuffer = req.file.buffer;
                const [parseError, importData] = await attemptPromise(() =>
                    Promise.resolve(JSON.parse(fileBuffer.toString("utf-8")))
                );

                if (parseError) {
                    res.status(400).json({ error: "Invalid JSON file", details: parseError.message });
                    return;
                }

                if (!importData.type || importData.type !== "global-lorebook" || !importData.lorebookEntries) {
                    res.status(400).json({ error: "Invalid global lorebook data format" });
                    return;
                }

                const newEntries = [];
                for (const entry of importData.lorebookEntries) {
                    // Validate entry is global
                    if (entry.level && entry.level !== "global") {
                        console.warn(`Skipping non-global entry ${entry.name}`);
                        continue;
                    }

                    const newEntry = {
                        ...entry,
                        id: nanoid(),
                        level: "global",
                        scopeId: null,
                        storyId: "", // Temporary for Phase 1
                        createdAt: new Date()
                    };

                    const result = await db.insert(table).values(newEntry).returning();
                    const created = Array.isArray(result) ? result[0] : result;
                    newEntries.push(transform(created));
                }

                res.json({
                    success: true,
                    imported: {
                        lorebookEntries: newEntries.length
                    },
                    entries: newEntries
                });
            })
        );
    }
});
