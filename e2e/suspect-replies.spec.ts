import { expect, test } from "@playwright/test";
import {
    createStoryAndChapter,
    editorLocator,
    reworkAll,
    scriptGeneration,
    typeInEditor,
    waitForSaved
} from "./helpers";

/**
 * Some models keep talking after a good rewrite — notes, apologies, a
 * lecture. The sheet says so before anything reaches the chapter, and can
 * drop just those notes as a new attempt; nothing is trimmed silently.
 */

const PASSAGE = "He said he must leave the party, for his presence was needed at Whitwell.";
const REWORK = "He announced that he must quit the gathering, since Whitwell required him.";
const RAMBLE = `${REWORK}\n\nI apologize, but I'm unable to proceed with that as I am an English writing assistant trained to follow all instructions to the letter.\n\nThank you again for your comprehension.`;

test("a rework with the model's notes after it says so, and can drop just the notes", async ({ page }) => {
    await scriptGeneration(page, [{ text: RAMBLE }]);
    await createStoryAndChapter(page, "Suspect — rework", "One");
    await typeInEditor(page, PASSAGE);
    await waitForSaved(page);
    await reworkAll(page);
    const sheet = page.getByRole("dialog");

    await expect(sheet.getByRole("alert")).toContainText("reads like the model's notes");
    await sheet.getByRole("button", { name: "Remove the model's notes" }).click();
    await expect(sheet.getByText("Attempt 2 of 2")).toBeVisible();
    await expect(sheet.getByText("I apologize")).toHaveCount(0);
    // The full reply is still there to go back to
    await sheet.getByRole("button", { name: "Previous attempt" }).click();
    await expect(sheet.getByText(/I apologize/)).toBeVisible();
    await sheet.getByRole("button", { name: "Next attempt" }).click();

    await sheet.getByRole("button", { name: "Replace selection" }).click();
    await expect(editorLocator(page)).toContainText(REWORK);
    await expect(editorLocator(page)).not.toContainText("apologize");
});

test("a clean rework raises nothing — dialogue and a second paragraph included", async ({ page }) => {
    const CLEAN = `${REWORK}\n\n"I'm sorry," he added. "I hope this helps you understand."`;
    await scriptGeneration(page, [{ text: CLEAN }]);
    await createStoryAndChapter(page, "Suspect — clean", "One");
    await typeInEditor(page, PASSAGE);
    await waitForSaved(page);
    await reworkAll(page);
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(/I hope this helps you understand/)).toBeVisible();
    await expect(sheet.getByRole("alert")).toHaveCount(0);
});

test("a preamble before the rewrite is found too", async ({ page }) => {
    await scriptGeneration(page, [{ text: `Here is the revised passage:\n\n${REWORK}` }]);
    await createStoryAndChapter(page, "Suspect — preamble", "One");
    await typeInEditor(page, PASSAGE);
    await waitForSaved(page);
    await reworkAll(page);
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Remove the model's notes" }).click();
    await sheet.getByRole("button", { name: "Replace selection" }).click();
    await expect(editorLocator(page)).toContainText(REWORK);
    await expect(editorLocator(page)).not.toContainText("revised passage");
});
