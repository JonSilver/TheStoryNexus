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
 * keep just the passage's worth of paragraphs; nothing is trimmed silently.
 */

const PASSAGE = "He said he must leave the party, for his presence was needed at Whitwell.";
const REWORK = "He announced that he must quit the gathering, since Whitwell required him.";
const RAMBLE = `${REWORK}\n\nI apologize, but I'm unable to proceed with that as I am an English writing assistant trained to follow all instructions to the letter.\n\nThank you again for your comprehension.`;

test("a rework that runs on past the passage is called out, and can keep just the passage", async ({ page }) => {
    await scriptGeneration(page, [{ text: RAMBLE }]);
    await createStoryAndChapter(page, "Suspect — rework", "One");
    await typeInEditor(page, PASSAGE);
    await waitForSaved(page);
    await reworkAll(page);
    const sheet = page.getByRole("dialog");

    await expect(sheet.getByRole("alert")).toContainText("This may be more than your passage");
    await sheet.getByRole("button", { name: "Keep only the first paragraph" }).click();
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

test("a clean rework raises nothing", async ({ page }) => {
    await scriptGeneration(page, [{ text: REWORK }]);
    await createStoryAndChapter(page, "Suspect — clean", "One");
    await typeInEditor(page, PASSAGE);
    await waitForSaved(page);
    await reworkAll(page);
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(REWORK)).toBeVisible();
    await expect(sheet.getByRole("alert")).toHaveCount(0);
});
