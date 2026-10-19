import { expect, test } from "@playwright/test";
import { createStoryAndChapter, mockGeneration, typeInEditor, waitForSaved } from "./helpers";

/**
 * Deriving a story's voice from its own prose: a draft for review, never
 * saved silently — and once saved, it steers every prose action.
 */

const GUIDE = "Write in past tense, close third person. Short declarative sentences. British spelling.";
const preview = (storyId: string, actionId: string, chapterId?: string) => ({
    actionId,
    storyId,
    ...(chapterId && { chapterId }),
    editorContext: {},
    modelRef: { provider: "local", modelId: "local/any" }
});

test("derive the story's voice from its prose, review it, and it steers generation once saved", async ({ page }) => {
    await mockGeneration(page, request => (request.actionId === "derive_voice" ? GUIDE : "unused"));
    await createStoryAndChapter(page, "Voice — derived", "One");
    await typeInEditor(page, "The harbour lights burned low. She waited by the wall.");
    await waitForSaved(page);
    const storyId = new URL(page.url()).pathname.split("/")[2];
    const chapterId = new URL(page.url()).pathname.split("/").pop() as string;
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByPlaceholder("New chapter title (optional)").fill("Two");
    await page.getByRole("button", { name: "Add" }).click();
    await typeInEditor(page, "Morning came grey over the estuary. Nobody spoke of the night.");
    await waitForSaved(page);

    // A fresh database has no AI settings row until something asks for one
    await page.request.get("/api/ai/settings");
    // What gets sent: passages from across the book, not just chapter one
    const derivePrompt = await (
        await page.request.post("/api/generate/preview", { data: preview(storyId, "derive_voice") })
    ).json();
    const sent = JSON.stringify(derivePrompt);
    expect(sent).toContain("harbour lights");
    expect(sent).toContain("grey over the estuary");

    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByText("Details, series & voice").click();
    await page.getByRole("button", { name: "Derive from my writing" }).click();
    const voice = page.getByLabel("Story voice");
    await expect(voice).toHaveValue(GUIDE);
    await expect(page.getByText(/Drafted from your writing/)).toBeVisible();

    // Not saved until the writer saves it
    const before = await (await page.request.get(`/api/stories/${storyId}`)).json();
    expect(before.aiInstructions ?? "").toBe("");
    await voice.fill(`${GUIDE} Never name the narrator.`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Drafted from your writing/)).toHaveCount(0);

    const continuePrompt = await (
        await page.request.post("/api/generate/preview", { data: preview(storyId, "continue", chapterId) })
    ).json();
    expect(JSON.stringify(continuePrompt)).toContain("Never name the narrator.");
});
