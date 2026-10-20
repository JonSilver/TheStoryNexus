import { attemptPromise } from "@jfdi/attempt";
import { eq } from "drizzle-orm";
import express from "express";
import fs from "fs";
import multer from "multer";
import os from "os";
import path from "path";
import { db, rawSqlite, schema } from "../db/client.js";
import { freshChatRevision } from "../lib/chatUpdate.js";
import { favouritesFromLegacy } from "../lib/favouriteModels.js";

type ImportedSeries = typeof schema.series.$inferSelect;
type ImportedStory = typeof schema.stories.$inferSelect;
type ImportedChapter = typeof schema.chapters.$inferSelect;
type ImportedLorebookEntry = typeof schema.lorebookEntries.$inferSelect;
type ImportedAiChat = typeof schema.aiChats.$inferSelect;
type ImportedNote = typeof schema.notes.$inferSelect;
type ImportedAiSetting = typeof schema.aiSettings.$inferSelect;

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// A copy of the .db file alone is NOT a snapshot in WAL mode — recent writing
// can live entirely in the -wal file. The online backup API produces a
// single consistent database file safe to copy while the app runs.
router.get("/backup", async (_, res) => {
    const backupPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "nexus-backup-")), "storynexus-backup.db");
    const [error] = await attemptPromise(() => rawSqlite.backup(backupPath));
    if (error) {
        console.error("Backup failed:", error);
        res.status(500).json({ error: "Backup failed" });
        return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    res.download(backupPath, `storynexus-backup-${stamp}.db`, () => {
        fs.rm(path.dirname(backupPath), { recursive: true, force: true }, () => undefined);
    });
});

router.get("/export", async (_, res) => {
    const [error, tables] = await attemptPromise(() =>
        Promise.all([
            db.select().from(schema.series),
            db.select().from(schema.stories),
            db.select().from(schema.chapters),
            db.select().from(schema.lorebookEntries),
            db.select().from(schema.aiChats),
            db.select().from(schema.notes),
            db.select().from(schema.aiSettings),
            db.select().from(schema.actionOverrides)
        ])
    );

    if (error) {
        console.error("Error exporting database:", error);
        res.status(500).json({ error: "Failed to export database", details: error.message });
        return;
    }

    const [series, stories, chapters, lorebookEntries, aiChats, notes, aiSettings, actionOverrides] = tables;
    // API keys never leave the server, including via export
    const sanitisedAiSettings = aiSettings.map(({ openaiKey: _o, openrouterKey: _r, geminiKey: _g, ...rest }) => rest);
    res.json({
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: {
            series,
            stories,
            chapters,
            lorebookEntries,
            aiChats,
            notes,
            aiSettings: sanitisedAiSettings,
            actionOverrides
        }
    });
});

router.get("/demo/exists", async (_, res) => {
    const [error, result] = await attemptPromise(async () => {
        const demoStory = await db
            .select({ id: schema.stories.id })
            .from(schema.stories)
            .where(eq(schema.stories.isDemo, true))
            .limit(1);
        return demoStory.length > 0;
    });

    if (error) {
        console.error("Error checking demo data:", error);
        res.status(500).json({ error: "Failed to check demo data", details: error.message });
        return;
    }

    res.json({ exists: result });
});

router.post("/demo/import", async (_, res) => {
    const { seedDemoStory } = await import("../db/seedDemoStory.js");

    const [error] = await attemptPromise(async () => {
        await seedDemoStory();
    });

    if (error) {
        console.error("Error importing demo story:", error);
        res.status(500).json({ error: "Failed to import demo story", details: error.message });
        return;
    }

    res.json({ success: true, message: "Demo story imported successfully" });
});

router.delete("/demo", async (_, res) => {
    const [error, deletedCounts] = await attemptPromise(async () => {
        // Delete demo data from all tables (cascade will handle related records)
        const seriesResult = await db.delete(schema.series).where(eq(schema.series.isDemo, true));
        const storiesResult = await db.delete(schema.stories).where(eq(schema.stories.isDemo, true));

        // Note: chapters, aiChats, notes will cascade automatically
        // lorebook entries need explicit deletion
        const lorebookResult = await db.delete(schema.lorebookEntries).where(eq(schema.lorebookEntries.isDemo, true));

        return {
            series: seriesResult.changes || 0,
            stories: storiesResult.changes || 0,
            lorebookEntries: lorebookResult.changes || 0
        };
    });

    if (error) {
        console.error("Error deleting demo data:", error);
        res.status(500).json({ error: "Failed to delete demo data", details: error.message });
        return;
    }

    console.log("Demo data deleted successfully:", deletedCounts);
    res.json({
        success: true,
        deleted: deletedCounts
    });
});

router.post("/import", upload.single("file"), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
    }

    console.log("[Import] Starting database import...");

    const fileBuffer = req.file.buffer;
    const [parseError, jsonData] = await attemptPromise(() =>
        Promise.resolve(JSON.parse(fileBuffer.toString("utf-8")))
    );

    if (parseError) {
        console.error("[Import] JSON parse failed:", parseError);
        res.status(400).json({ error: "Invalid JSON file", details: parseError.message });
        return;
    }

    if (!jsonData.version || !jsonData.tables) {
        console.error("[Import] Invalid format - missing version or tables");
        res.status(400).json({ error: "Invalid import file format - missing version or tables property" });
        return;
    }

    const { tables } = jsonData;
    console.log("[Import] File parsed. Tables found:", Object.keys(tables));

    // Whole import runs in one synchronous better-sqlite3 transaction:
    // any failure rolls back to the pre-import database
    const [error, counts] = await attemptPromise(async () =>
        db.transaction(tx => {
            const importTable = <T, S extends (typeof schema)[keyof typeof schema]>(
                tableName: string,
                tableSchema: S,
                data: unknown,
                transform: (item: T) => S["$inferInsert"]
            ) => {
                if (!Array.isArray(data) || data.length === 0) {
                    console.log(`[Import] Skipping ${tableName} - no data`);
                    return 0;
                }
                for (const item of data as T[]) tx.insert(tableSchema).values(transform(item)).run();
                console.log(`[Import] ✓ Imported ${data.length} ${tableName}`);
                return data.length;
            };

            console.log("[Import] Clearing existing data...");
            tx.delete(schema.notes).run();
            tx.delete(schema.lorebookEntries).run();
            tx.delete(schema.aiChats).run();
            tx.delete(schema.chapters).run();
            tx.delete(schema.stories).run();
            tx.delete(schema.series).run();
            tx.delete(schema.aiSettings).run();

            return {
                series: importTable("series", schema.series, tables.series, (s: ImportedSeries) => ({
                    ...s,
                    createdAt: new Date(s.createdAt)
                })),
                stories: importTable("stories", schema.stories, tables.stories, (s: ImportedStory) => ({
                    ...s,
                    createdAt: new Date(s.createdAt)
                })),
                chapters: importTable("chapters", schema.chapters, tables.chapters, (c: ImportedChapter) => ({
                    ...c,
                    createdAt: new Date(c.createdAt)
                })),
                lorebookEntries: importTable(
                    "lorebookEntries",
                    schema.lorebookEntries,
                    tables.lorebookEntries,
                    (e: ImportedLorebookEntry) => ({ ...e, createdAt: new Date(e.createdAt) })
                ),
                aiChats: importTable("aiChats", schema.aiChats, tables.aiChats, (c: ImportedAiChat) => ({
                    ...c,
                    revision: freshChatRevision(),
                    createdAt: new Date(c.createdAt),
                    updatedAt: c.updatedAt ? new Date(c.updatedAt) : undefined
                })),
                notes: importTable("notes", schema.notes, tables.notes, (n: ImportedNote) => ({
                    ...n,
                    createdAt: new Date(n.createdAt),
                    updatedAt: n.updatedAt ? new Date(n.updatedAt) : new Date(n.createdAt)
                })),
                aiSettings: importTable(
                    "aiSettings",
                    schema.aiSettings,
                    tables.aiSettings,
                    // Keys are stripped from exports and must not sneak back in via import
                    ({ openaiKey: _o, openrouterKey: _r, geminiKey: _g, ...s }: ImportedAiSetting) => ({
                        ...s,
                        favouriteModels: favouritesFromLegacy(s),
                        createdAt: new Date(s.createdAt),
                        lastModelsFetch: s.lastModelsFetch ? new Date(s.lastModelsFetch) : undefined
                    })
                )
            };
        })
    );

    if (error) {
        console.error("[Import] Import failed:", error);
        res.status(500).json({ error: "Failed to import database", details: error.message });
        return;
    }

    console.log("[Import] ✓ Import completed successfully");
    res.json({
        success: true,
        imported: counts
    });
});

export default router;
