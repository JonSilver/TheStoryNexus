import { attemptPromise } from "@jfdi/attempt";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StoryExport } from "../../src/types/story.js";
import { db, schema } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const seedDemoStory = async () => {
    const [checkError, existingDemoStory] = await attemptPromise(() =>
        db.select().from(schema.stories).where(eq(schema.stories.id, "demo-story-shadows-berlin"))
    );

    if (checkError) {
        console.error("Error checking for existing demo story:", checkError);
        throw checkError;
    }

    if (existingDemoStory.length > 0) {
        console.log("Demo story already exists, skipping seed");
        return;
    }

    console.log("Seeding demo story...");

    const [error] = await attemptPromise(async () => {
        const demoDataPath = path.join(__dirname, "../data/demo-story-shadows-berlin.json");
        const demoDataRaw = readFileSync(demoDataPath, "utf-8");
        const demoData: StoryExport = JSON.parse(demoDataRaw);

        await db.insert(schema.stories).values({
            id: demoData.story.id,
            title: demoData.story.title,
            author: demoData.story.author,
            language: demoData.story.language,
            synopsis: demoData.story.synopsis || null,
            seriesId: null,
            createdAt: new Date(demoData.story.createdAt),
            isDemo: true
        });

        if (demoData.chapters && demoData.chapters.length > 0) {
            const chaptersToInsert = demoData.chapters.map(chapter => ({
                id: chapter.id,
                storyId: chapter.storyId,
                title: chapter.title,
                summary: chapter.summary || null,
                order: chapter.order,
                content: chapter.content,
                outline: chapter.outline || null,
                wordCount: chapter.wordCount,
                povCharacter: chapter.povCharacter || null,
                povType: chapter.povType || null,
                notes: chapter.notes || null,
                createdAt: new Date(chapter.createdAt),
                isDemo: true
            }));
            await db.insert(schema.chapters).values(chaptersToInsert);
        }

        if (demoData.lorebookEntries && demoData.lorebookEntries.length > 0) {
            const lorebookToInsert = demoData.lorebookEntries.map(entry => ({
                id: entry.id,
                level: entry.level,
                scopeId: entry.scopeId || null,
                name: entry.name,
                description: entry.description,
                category: entry.category,
                tags: entry.tags,
                metadata: entry.metadata || null,
                isDisabled: entry.isDisabled || false,
                createdAt: new Date(entry.createdAt),
                isDemo: true
            }));
            await db.insert(schema.lorebookEntries).values(lorebookToInsert);
        }

        if (demoData.aiChats && demoData.aiChats.length > 0) {
            const chatsToInsert = demoData.aiChats.map(chat => ({
                id: chat.id,
                storyId: chat.storyId,
                title: chat.title,
                messages: chat.messages,
                createdAt: new Date(chat.createdAt),
                updatedAt: chat.updatedAt ? new Date(chat.updatedAt) : null,
                lastUsedPromptId: chat.lastUsedPromptId || null,
                lastUsedModelId: chat.lastUsedModelId || null,
                isDemo: true
            }));
            await db.insert(schema.aiChats).values(chatsToInsert);
        }

        if (demoData.sceneBeats && demoData.sceneBeats.length > 0) {
            const sceneBeatsToInsert = demoData.sceneBeats.map(beat => ({
                id: beat.id,
                storyId: beat.storyId,
                chapterId: beat.chapterId,
                command: beat.command,
                povType: beat.povType || null,
                povCharacter: beat.povCharacter || null,
                generatedContent: beat.generatedContent || null,
                accepted: beat.accepted || false,
                metadata: beat.metadata || null,
                createdAt: new Date(beat.createdAt)
            }));
            await db.insert(schema.sceneBeats).values(sceneBeatsToInsert);
        }

        if (demoData.notes && demoData.notes.length > 0) {
            const notesToInsert = demoData.notes.map(note => ({
                id: note.id,
                storyId: note.storyId,
                title: note.title,
                content: note.content,
                type: note.type,
                createdAt: new Date(note.createdAt),
                updatedAt: new Date(note.updatedAt),
                isDemo: true
            }));
            await db.insert(schema.notes).values(notesToInsert);
        }

        console.log(
            `Successfully seeded demo story with ${demoData.chapters?.length || 0} chapters, ${demoData.lorebookEntries?.length || 0} lorebook entries, ${demoData.aiChats?.length || 0} AI chats, and ${demoData.notes?.length || 0} notes`
        );
    });

    if (error) {
        console.error("Error seeding demo story:", error);
        throw error;
    }
};
