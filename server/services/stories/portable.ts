/**
 * Story JSON backup format: everything a writer would lose if the story
 * vanished — chapters, story-level bible, chats, notes, per-story AI
 * overrides and images. Import builds fresh rows under a new story id; this
 * module is pure so the round trip is unit-testable.
 */
import type { InferInsertModel } from "drizzle-orm";
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
    assets?: PortableAsset[];
}

export interface StoryImportRows {
    story: InferInsertModel<typeof schema.stories>;
    chapters: InferInsertModel<typeof schema.chapters>[];
    lorebookEntries: InferInsertModel<typeof schema.lorebookEntries>[];
    aiChats: InferInsertModel<typeof schema.aiChats>[];
    notes: InferInsertModel<typeof schema.notes>[];
    actionOverrides: InferInsertModel<typeof schema.actionOverrides>[];
}

/** Timestamps arrive as JSON strings; drizzle's timestamp columns need Dates. */
const toDate = (value: unknown, fallback: Date): Date => {
    if (value === null || value === undefined) return fallback;
    const date = new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? fallback : date;
};

/** Images are served from /api/assets/{storyId}/… — chapter JSON must follow the story to its new id. */
export const rewriteAssetUrls = (content: string, fromStoryId: string, toStoryId: string): string =>
    content.split(`/api/assets/${fromStoryId}/`).join(`/api/assets/${toStoryId}/`);

const isValidStoryEntry = (entry: Row): boolean =>
    typeof entry.name === "string" &&
    (entry.level === undefined || ["global", "series", "story"].includes(entry.level as string));

export const buildStoryImport = (
    backup: StoryBackup,
    newStoryId: string,
    newId: () => string,
    now: Date
): StoryImportRows => {
    const oldStoryId = backup.story.id;
    const { id: _id, seriesId: _series, ...story } = backup.story;

    return {
        story: {
            ...(story as InferInsertModel<typeof schema.stories>),
            id: newStoryId,
            title: `${backup.story.title} (Imported)`,
            // Series membership is a relationship to data outside the backup
            seriesId: null,
            createdAt: now
        },
        chapters: (backup.chapters ?? []).map(chapter => ({
            ...(chapter as InferInsertModel<typeof schema.chapters>),
            id: newId(),
            storyId: newStoryId,
            content: rewriteAssetUrls(String(chapter.content ?? ""), oldStoryId, newStoryId),
            createdAt: now,
            updatedAt: toDate(chapter.updatedAt, now)
        })),
        // Inherited (series/global) entries are never in a story backup; anything
        // present comes back as this story's own
        lorebookEntries: (backup.lorebookEntries ?? []).filter(isValidStoryEntry).map(entry => ({
            ...(entry as InferInsertModel<typeof schema.lorebookEntries>),
            id: newId(),
            level: "story",
            scopeId: newStoryId,
            createdAt: now
        })),
        aiChats: (backup.aiChats ?? []).map(chat => ({
            ...(chat as InferInsertModel<typeof schema.aiChats>),
            id: newId(),
            storyId: newStoryId,
            createdAt: toDate(chat.createdAt, now),
            updatedAt: toDate(chat.updatedAt, now)
        })),
        notes: (backup.notes ?? []).map(note => ({
            ...(note as InferInsertModel<typeof schema.notes>),
            id: newId(),
            storyId: newStoryId,
            createdAt: toDate(note.createdAt, now),
            updatedAt: toDate(note.updatedAt, now)
        })),
        actionOverrides: (backup.actionOverrides ?? []).map(override => ({
            ...(override as InferInsertModel<typeof schema.actionOverrides>),
            id: newId(),
            storyId: newStoryId,
            createdAt: toDate(override.createdAt, now)
        }))
    };
};
