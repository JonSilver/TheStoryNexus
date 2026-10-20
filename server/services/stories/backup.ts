/**
 * Database side of story/series backups: reading a complete backup out, and
 * writing built import rows in. Story and series backups share one shape per
 * story so neither can drift into exporting less than the other.
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "../../db/client.js";
import { readStoryAssets, writeStoryAssets } from "../assets/storage.js";
import { buildStoryImport, type SeriesImportRows, type StoryBackup, type StoryImportRows } from "./portable.js";

export const exportStoryBackup = async (storyId: string) => {
    const [story] = await db.select().from(schema.stories).where(eq(schema.stories.id, storyId));
    if (!story) return null;

    const [chapters, lorebookEntries, aiChats, notes, actionOverrides, transpositions, assets] = await Promise.all([
        db.select().from(schema.chapters).where(eq(schema.chapters.storyId, storyId)),
        // Story-level only — inherited series/global entries belong to their own scope
        db
            .select()
            .from(schema.lorebookEntries)
            .where(and(eq(schema.lorebookEntries.level, "story"), eq(schema.lorebookEntries.scopeId, storyId))),
        db.select().from(schema.aiChats).where(eq(schema.aiChats.storyId, storyId)),
        db.select().from(schema.notes).where(eq(schema.notes.storyId, storyId)),
        db.select().from(schema.actionOverrides).where(eq(schema.actionOverrides.storyId, storyId)),
        db.select().from(schema.transpositions).where(eq(schema.transpositions.storyId, storyId)),
        // Images travel inside the backup, or restoring loses them
        readStoryAssets(storyId)
    ]);

    return {
        version: "1.0",
        type: "story" as const,
        exportDate: new Date().toISOString(),
        story,
        chapters,
        lorebookEntries,
        aiChats,
        notes,
        actionOverrides,
        transposition: transpositions[0] ?? null,
        assets
    };
};

export const exportSeriesBackup = async (seriesId: string) => {
    const [series] = await db.select().from(schema.series).where(eq(schema.series.id, seriesId));
    if (!series) return null;

    const [lorebookEntries, members] = await Promise.all([
        db
            .select()
            .from(schema.lorebookEntries)
            .where(and(eq(schema.lorebookEntries.level, "series"), eq(schema.lorebookEntries.scopeId, seriesId))),
        db.select({ id: schema.stories.id }).from(schema.stories).where(eq(schema.stories.seriesId, seriesId))
    ]);
    const stories = await Promise.all(members.map(member => exportStoryBackup(member.id)));

    return {
        version: "1.0",
        type: "series" as const,
        exportDate: new Date().toISOString(),
        series,
        lorebookEntries,
        stories: stories.filter(story => story !== null)
    };
};

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Synchronous by design: better-sqlite3 transactions must not await. */
const insertStoryRows = (tx: Tx, rows: StoryImportRows) => {
    tx.insert(schema.stories).values(rows.story).run();
    if (rows.chapters.length) tx.insert(schema.chapters).values(rows.chapters).run();
    if (rows.lorebookEntries.length) tx.insert(schema.lorebookEntries).values(rows.lorebookEntries).run();
    if (rows.aiChats.length) tx.insert(schema.aiChats).values(rows.aiChats).run();
    if (rows.notes.length) tx.insert(schema.notes).values(rows.notes).run();
    if (rows.actionOverrides.length) tx.insert(schema.actionOverrides).values(rows.actionOverrides).run();
    if (rows.transposition) tx.insert(schema.transpositions).values(rows.transposition).run();
};

/** All-or-nothing: a half-restored backup is worse than none. */
/** `also` writes in the same transaction — what must exist with the story or not at all. */
const commitStoryImport = (rows: StoryImportRows, also?: (tx: Tx, rows: StoryImportRows) => void) =>
    db.transaction(tx => {
        insertStoryRows(tx, rows);
        also?.(tx, rows);
    });

export const commitSeriesImport = (rows: SeriesImportRows) =>
    db.transaction(tx => {
        tx.insert(schema.series).values(rows.series).run();
        if (rows.lorebookEntries.length) tx.insert(schema.lorebookEntries).values(rows.lorebookEntries).run();
        for (const story of rows.stories) insertStoryRows(tx, story.rows);
    });

/**
 * A story backup made into a new story — a restored file or a duplicate — all
 * or nothing, then its images; any that can't be written are reported.
 */
export const restoreStory = async (
    backup: StoryBackup,
    options: {
        seriesId?: string | null;
        title?: string;
        titleSuffix?: string;
        also?: (tx: Tx, rows: StoryImportRows) => void;
    } = {}
) => {
    const storyId = crypto.randomUUID();
    const rows = buildStoryImport(backup, storyId, () => crypto.randomUUID(), new Date(), options);
    if (options.title) rows.story.title = options.title;
    commitStoryImport(rows, options.also);
    const assetsFailed = await writeStoryAssets(storyId, backup.assets ?? []);
    return {
        success: true,
        storyId,
        title: rows.story.title,
        imported: {
            chapters: rows.chapters.length,
            lorebookEntries: rows.lorebookEntries.length,
            aiChats: rows.aiChats.length,
            notes: rows.notes.length,
            actionOverrides: rows.actionOverrides.length,
            assets: (backup.assets ?? []).length - assetsFailed.length
        },
        assetsFailed
    };
};
