/**
 * Story/series JSON backup format: everything a writer would lose if the
 * story vanished — chapters, story-level bible, chats, notes, per-story AI
 * overrides and images. A backup file is UNTRUSTED input: rows are rebuilt
 * from explicit field allowlists (never spread), so an import can't set
 * internal flags such as isDemo or smuggle in ids and foreign keys. Pure,
 * so the round trip is unit-testable.
 */
import type { InferInsertModel } from "drizzle-orm";
import { readStage, readState, remapState } from "../../../src/v2/transpose/state.js";
import type { schema } from "../../db/client.js";

export interface PortableAsset {
    filename: string;
    /** base64 */
    data: string;
}

type Row = Record<string, unknown>;

export interface StoryBackup {
    type: "story";
    story: Row & { id: string; title: string };
    chapters?: Row[];
    lorebookEntries?: Row[];
    aiChats?: Row[];
    notes?: Row[];
    actionOverrides?: Row[];
    /** A transposition in progress on this story (#77): its drafts are work too. */
    transposition?: Row | null;
    assets?: PortableAsset[];
}

export interface StoryImportRows {
    story: InferInsertModel<typeof schema.stories>;
    chapters: InferInsertModel<typeof schema.chapters>[];
    lorebookEntries: InferInsertModel<typeof schema.lorebookEntries>[];
    aiChats: InferInsertModel<typeof schema.aiChats>[];
    notes: InferInsertModel<typeof schema.notes>[];
    actionOverrides: InferInsertModel<typeof schema.actionOverrides>[];
    transposition: InferInsertModel<typeof schema.transpositions> | null;
}

const str = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);
const optStr = (value: unknown): string | null => (typeof value === "string" ? value : null);
const optNum = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const num = (value: unknown, fallback: number): number => optNum(value) ?? fallback;
const optCount = (value: unknown): number | null =>
    Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null;
const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** Timestamps arrive as JSON strings; drizzle's timestamp columns need Dates. */
const toDate = (value: unknown, fallback: Date): Date => {
    if (value === null || value === undefined) return fallback;
    const date = new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? fallback : date;
};

const LOREBOOK_CATEGORIES = new Set([
    "character",
    "location",
    "item",
    "event",
    "note",
    "synopsis",
    "starting scenario",
    "timeline"
]);

/** Images are served from /api/assets/{storyId}/… — chapter JSON must follow the story to its new id. */
export const rewriteAssetUrls = (content: string, fromStoryId: string, toStoryId: string): string =>
    content.split(`/api/assets/${fromStoryId}/`).join(`/api/assets/${toStoryId}/`);

export const buildStoryImport = (
    backup: StoryBackup,
    newStoryId: string,
    newId: () => string,
    now: Date,
    options: { seriesId?: string | null; titleSuffix?: string } = {}
): StoryImportRows => {
    const oldStoryId = backup.story.id;
    const story = backup.story;
    // Entries kept, with their new ids — a transposition's drafts are keyed by them
    const entries = (backup.lorebookEntries ?? [])
        .filter(entry => typeof entry.name === "string" && entry.name.trim())
        .map(entry => ({ entry, id: newId() }));
    const entryIds = new Map(
        entries.flatMap(({ entry, id }) => (typeof entry.id === "string" ? [[entry.id, id]] : []))
    );
    const chapters = (backup.chapters ?? []).map(chapter => ({ chapter, id: newId() }));
    const chapterIds = new Map(
        chapters.flatMap(({ chapter, id }) => (typeof chapter.id === "string" ? [[chapter.id, id]] : []))
    );
    const transposition =
        backup.transposition && typeof backup.transposition.target === "string" ? backup.transposition : null;

    return {
        story: {
            id: newStoryId,
            title: `${str(story.title, "Untitled")}${options.titleSuffix ?? " (Imported)"}`,
            author: str(story.author),
            language: str(story.language, "British English"),
            synopsis: optStr(story.synopsis),
            aiInstructions: optStr(story.aiInstructions),
            // A story backup carries no series; a series import passes its own
            seriesId: options.seriesId ?? null,
            createdAt: now
        },
        chapters: chapters.map(({ chapter, id }, index) => ({
            id,
            storyId: newStoryId,
            title: str(chapter.title, `Chapter ${index + 1}`),
            summary: optStr(chapter.summary),
            order: num(chapter.order, index),
            content: rewriteAssetUrls(str(chapter.content), oldStoryId, newStoryId),
            revision: optCount(chapter.revision) ?? 0,
            // Kept so a transposition's drafts, made from this version, still fit it
            saveVersion: optCount(chapter.saveVersion) ?? 0,
            // A summary can't be fresher than the prose it summarises — or exist without text
            summarySourceRevision: (() => {
                const source = optCount(chapter.summarySourceRevision);
                const hasSummary = Boolean(optStr(chapter.summary)?.trim());
                return hasSummary && source !== null && source <= (optCount(chapter.revision) ?? 0) ? source : null;
            })(),
            // The base small edits accumulate against — without it a restore forgets them
            revisionText: optStr(chapter.revisionText),
            summaryLocked: chapter.summaryLocked === true,
            outline: chapter.outline ?? null,
            wordCount: num(chapter.wordCount, 0),
            povCharacter: optStr(chapter.povCharacter),
            povType: optStr(chapter.povType),
            notes: chapter.notes ?? null,
            createdAt: now,
            updatedAt: toDate(chapter.updatedAt, now)
        })),
        // Inherited (series/global) entries are never in a story backup; anything
        // present comes back as this story's own
        lorebookEntries: entries.map(({ entry, id }) => ({
            id,
            level: "story",
            scopeId: newStoryId,
            name: str(entry.name),
            description: str(entry.description),
            category: LOREBOOK_CATEGORIES.has(str(entry.category)) ? str(entry.category) : "note",
            tags: strings(entry.tags),
            metadata: entry.metadata ?? null,
            isDisabled: entry.isDisabled === true,
            createdAt: now
        })),
        aiChats: (backup.aiChats ?? []).map(chat => ({
            id: newId(),
            storyId: newStoryId,
            title: str(chat.title, "Chat"),
            messages: Array.isArray(chat.messages) ? chat.messages : [],
            createdAt: toDate(chat.createdAt, now),
            updatedAt: toDate(chat.updatedAt, now)
        })),
        notes: (backup.notes ?? []).map(note => ({
            id: newId(),
            storyId: newStoryId,
            title: str(note.title, "Untitled"),
            content: str(note.content),
            type: str(note.type, "idea"),
            createdAt: toDate(note.createdAt, now),
            updatedAt: toDate(note.updatedAt, now)
        })),
        actionOverrides: (backup.actionOverrides ?? [])
            .filter(override => typeof override.actionId === "string")
            .map(override => ({
                id: newId(),
                actionId: str(override.actionId),
                storyId: newStoryId,
                // Values are re-validated at execution (resolve.ts falls through on invalid)
                template: override.template ?? null,
                temperature: optNum(override.temperature),
                maxTokens: optNum(override.maxTokens),
                topP: optNum(override.topP),
                frequencyPenalty: optNum(override.frequencyPenalty),
                presencePenalty: optNum(override.presencePenalty),
                modelRef: optStr(override.modelRef),
                createdAt: toDate(override.createdAt, now)
            })),
        transposition: transposition && {
            id: newId(),
            storyId: newStoryId,
            // The original may not exist where this is restored: the link is only for showing where it came from
            sourceStoryId: null,
            target: str(transposition.target),
            brief: optStr(transposition.brief),
            stage: readStage(transposition.stage),
            state: remapState(readState(transposition.state), entryIds, chapterIds),
            createdAt: toDate(transposition.createdAt, now),
            updatedAt: toDate(transposition.updatedAt, now)
        }
    };
};

export interface SeriesBackup {
    type: "series";
    series: Row & { id: string; name: string };
    lorebookEntries?: Row[];
    stories?: StoryBackup[];
}

export interface SeriesImportRows {
    series: InferInsertModel<typeof schema.series>;
    lorebookEntries: InferInsertModel<typeof schema.lorebookEntries>[];
    stories: Array<{ rows: StoryImportRows; assets: PortableAsset[] }>;
}

/** A series backup is a series row, its series-level bible, and a story backup per member story. */
export const buildSeriesImport = (
    backup: SeriesBackup,
    newSeriesId: string,
    newId: () => string,
    now: Date
): SeriesImportRows => ({
    series: {
        id: newSeriesId,
        name: `${str(backup.series.name, "Untitled series")} (Imported)`,
        description: optStr(backup.series.description),
        createdAt: now
    },
    lorebookEntries: (backup.lorebookEntries ?? [])
        .filter(entry => typeof entry.name === "string" && entry.name.trim())
        .map(entry => ({
            id: newId(),
            level: "series",
            scopeId: newSeriesId,
            name: str(entry.name),
            description: str(entry.description),
            category: LOREBOOK_CATEGORIES.has(str(entry.category)) ? str(entry.category) : "note",
            tags: strings(entry.tags),
            metadata: entry.metadata ?? null,
            isDisabled: entry.isDisabled === true,
            createdAt: now
        })),
    stories: (backup.stories ?? [])
        .filter(story => story?.story && typeof story.story.id === "string")
        .map(story => ({
            // Member stories keep their own titles — the series name carries the "(Imported)"
            rows: buildStoryImport(story, newId(), newId, now, { seriesId: newSeriesId, titleSuffix: "" }),
            assets: story.assets ?? []
        }))
});
