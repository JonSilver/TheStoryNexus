import { expect, test } from "@playwright/test";
import {
    STALL,
    createStoryAndChapter,
    editorLocator,
    scriptGeneration as script,
    typeInEditor,
    waitForSaved
} from "./helpers";

/**
 * Bible tools never cost the writer a result: looking again adds, merges are
 * all kept with their edits, a reply that fails after completing still
 * offers its finds, and a whole-story run stops paying when the model is
 * broken — and never throws away what it found.
 */

test.describe.configure({ mode: "serial" });

test("bible: Look again adds new finds and keeps the earlier ones", async ({ page }) => {
    const entry = (name: string) =>
        JSON.stringify([{ name, category: "character", description: `${name} is in the chapter.`, tags: [] }]);
    await script(page, [{ text: entry("Elinor") }, { text: entry("Marianne") }]);
    await createStoryAndChapter(page, "Fixes — look again", "One");
    await typeInEditor(page, "Elinor and Marianne walked to the church.");
    await waitForSaved(page);
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();
    await page.getByRole("button", { name: "Extract from chapter" }).click();
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByText("Elinor is in the chapter.")).toBeVisible();

    await page.getByRole("button", { name: "Look again" }).click();
    await expect(page.getByText("Marianne is in the chapter.")).toBeVisible();
    await expect(page.getByText("Elinor is in the chapter.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add 2 to bible" })).toBeVisible();
});

test("bible: whole-story extraction stops after two failing chapters and says why", async ({ page }) => {
    const calls = await script(page, [
        { error: "the server doesn't have this model." },
        { error: "the server doesn't have this model." },
        { error: "the server doesn't have this model." }
    ]);
    await createStoryAndChapter(page, "Fixes — sweep", "One");
    for (const title of ["Two", "Three"]) {
        await page.getByRole("button", { name: "Story", exact: true }).click();
        await page.getByRole("button", { name: "Chapters" }).click();
        await page.getByPlaceholder("New chapter title (optional)").fill(title);
        await page.getByRole("button", { name: "Add" }).click();
        await expect(editorLocator(page)).toBeVisible();
    }
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();
    await page.getByRole("button", { name: "Extract from whole story" }).click();
    await page.getByRole("button", { name: "Run" }).click();

    await expect(page.getByText(/Stopped after two chapters in a row failed \(“One”, “Two”\)/)).toBeVisible();
    await expect(page.getByText(/doesn't have this model/)).toBeVisible();
    await expect(page.getByText(/Nothing extractable/)).toHaveCount(0);
    expect(calls).toHaveLength(2);
});

test("bible: retrying a merge keeps the earlier result and the writer's edits to it", async ({ page }) => {
    const merged = (description: string) =>
        JSON.stringify([{ name: "Colonel Brandon", category: "character", description, tags: [] }]);
    await script(page, [{ text: merged("First merge.") }, { hold: true }, { text: merged("Second merge.") }]);
    await createStoryAndChapter(page, "Fixes — merge", "One");
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();
    for (const [name, desc] of [
        ["Colonel Brandon", "Steady and quiet."],
        ["Brandon", "Plays badly."]
    ]) {
        await page.getByRole("button", { name: "New entry" }).click();
        await page.getByLabel("Entry name").fill(name);
        await page.getByLabel("Description").fill(desc);
        await page.getByRole("button", { name: "Save" }).click();
    }
    await page.getByRole("button", { name: "Merge duplicates" }).click();
    await page.getByRole("button", { name: /Colonel Brandon \+ Brandon/ }).click();
    await page.getByRole("button", { name: "Merge with AI" }).click();
    await expect(page.getByLabel("Merged description")).toHaveValue("First merge.");
    await page.getByLabel("Merged description").fill("First merge, with my edit.");

    // A held retry can be stopped — and stopping costs nothing already there
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByLabel("Merged description")).toHaveValue("First merge, with my edit.");

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByLabel("Merged description")).toHaveValue("Second merge.");
    await expect(page.getByText("Merge 2 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Previous merge" }).click();
    await expect(page.getByLabel("Merged description")).toHaveValue("First merge, with my edit.");
});

test("bible: a complete reply whose stream then fails still offers what it found", async ({ page }) => {
    const found = JSON.stringify([{ name: "Mara", category: "character", description: "A pilot.", tags: [] }]);
    await script(page, [{ partial: found, error: STALL }]);
    await createStoryAndChapter(page, "Fixes — extract partial", "One");
    await typeInEditor(page, "Mara flew north.");
    await waitForSaved(page);
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();
    await page.getByRole("button", { name: "Extract from chapter" }).click();
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByText(/stopped sending text/)).toBeVisible();
    await expect(page.getByText("A pilot.")).toBeVisible();
    await expect(page.getByText(/Nothing extractable/)).toHaveCount(0);
});

test("bible: whole-story finds appear as they arrive, and closing mid-run asks first", async ({ page }) => {
    const entry = JSON.stringify([{ name: "Elinor", category: "character", description: "Found first.", tags: [] }]);
    await script(page, [{ text: entry }, { hold: true }]);
    await createStoryAndChapter(page, "Fixes — sweep close", "One");
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByPlaceholder("New chapter title (optional)").fill("Two");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(editorLocator(page)).toBeVisible();
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();
    await page.getByRole("button", { name: "Extract from whole story" }).click();
    await page.getByRole("button", { name: "Run" }).click();

    // Chapter one's find is on screen while chapter two is still being read
    await expect(page.getByText("Found first.")).toBeVisible();
    const asked: string[] = [];
    page.once("dialog", dialog => {
        asked.push(dialog.message());
        void dialog.dismiss();
    });
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();
    await expect.poll(() => asked.length).toBe(1);
    expect(asked[0]).toContain("1 entry found so far");
    await expect(page.getByText("Found first.")).toBeVisible();
});
