import type { Page } from "@playwright/test";
import { createStoryAndChapter, typeInEditor, waitForSaved } from "./helpers";

export const BRIEF = "Setting: Belfast, 1994. Whitwell Hall becomes the corner shop.";
export const SYNOPSIS = "A shopkeeper's daughter must choose between the shop and a life in London.";

/** The original a transposition starts from: a story in a series, with a story entry and a series entry. */
export const seedOriginal = async (page: Page) => {
    await createStoryAndChapter(page, "Transpose — original", "One");
    const storyId = new URL(page.url()).pathname.split("/")[2];
    await typeInEditor(page, "Aunt Hester ruled Whitwell Hall.");
    await waitForSaved(page);
    const series = await (await page.request.post("/api/series", { data: { name: "The Whitwell Books" } })).json();
    await page.request.put(`/api/stories/${storyId}`, {
        data: { seriesId: series.id, synopsis: "A gentleman's daughter must choose between duty and love." }
    });
    const entry = (name: string, level: "story" | "series", scopeId: string, category: string) =>
        page.request.post("/api/lorebook", {
            data: { level, scopeId, name, description: `${name}, as it was.`, category, tags: [] }
        });
    await entry("Aunt Hester", "story", storyId, "character");
    await entry("Whitwell Hall", "series", series.id, "location");
    return { storyId, seriesId: series.id as string };
};
