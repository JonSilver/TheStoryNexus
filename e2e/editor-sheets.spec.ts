import { expect, type Page, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator, scriptGeneration, typeInEditor, waitForSaved } from "./helpers";

/**
 * The editor and its AI sheets: a conflicted chapter stays locked whatever
 * the sheets do, Discard really cancels, and one action's typing never
 * leaks into the next.
 */

test.describe.configure({ mode: "serial" });

const editable = (page: Page) => page.locator('[data-lexical-editor="true"]').getAttribute("contenteditable");

const summarise = async (page: Page) => {
    await page.getByRole("button", { name: "More tools" }).first().click();
    await page.getByText("Summarise chapter").click();
};

test("a chapter changed elsewhere stays locked after an AI sheet is closed", async ({ page }) => {
    await scriptGeneration(page, [{ text: "A summary." }]);
    await createStoryAndChapter(page, "Sheets — conflict lock", "One");
    await typeInEditor(page, "Mine.");
    await waitForSaved(page);
    const chapterId = new URL(page.url()).pathname.split("/").pop();
    const url = `/api/chapters/${chapterId}`;
    const chapter = await (await page.request.get(url)).json();
    // Another device saves first
    await page.request.put(url, {
        data: {
            content: chapter.content.replace("Mine.", "Theirs."),
            wordCount: 1,
            expectedSaveVersion: chapter.saveVersion
        }
    });
    await typeInEditor(page, " More of mine.");
    await expect(page.getByText(/This chapter was changed elsewhere/)).toBeVisible();
    await expect.poll(() => editable(page)).toBe("false");

    await summarise(page);
    await expect(page.getByRole("dialog").getByText("A summary.")).toBeVisible();
    await page.getByRole("button", { name: "Discard" }).click();
    await expect.poll(() => editable(page)).toBe("false");
});

test("discarding a summary that's still starting never runs it", async ({ page }) => {
    const calls = await scriptGeneration(page, [{ text: "Should never be asked for." }]);
    await createStoryAndChapter(page, "Sheets — discard early", "One");
    await typeInEditor(page, "Some prose to summarise.");
    await waitForSaved(page);
    // Discard while the summary is still being prepared (its save flush and chapter read are slow)
    await page.route("**/api/chapters/*", async route => {
        await new Promise(resolve => setTimeout(resolve, 1_500));
        return route.fallback();
    });
    await summarise(page);
    await page.getByRole("button", { name: "Discard" }).click();
    await page.waitForTimeout(2_500);
    expect(calls).toHaveLength(0);
});

test("text typed into one AI sheet never appears in the next", async ({ page }) => {
    await scriptGeneration(page, [{ text: "Reworked." }]);
    await createStoryAndChapter(page, "Sheets — no carry-over", "One");
    await typeInEditor(page, "A passage to ask about.");
    await waitForSaved(page);
    await editorLocator(page).click();
    await page.keyboard.press("Control+A");
    await page.getByRole("button", { name: "Ask about selection" }).click();
    await page.getByPlaceholder(/What should happen to this passage/).fill("A half-typed instruction");
    await page.getByRole("button", { name: "Cancel" }).click();

    await editorLocator(page).click();
    await page.keyboard.press("Control+A");
    await page.getByRole("button", { name: "Ask about selection" }).click();
    await expect(page.getByPlaceholder(/What should happen to this passage/)).toHaveValue("");
});
