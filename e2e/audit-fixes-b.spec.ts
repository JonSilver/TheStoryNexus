import { expect, type Page, type Route, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator, typeInEditor, waitForSaved } from "./helpers";

/**
 * Audit fixes: the details sheet saves only what the writer changed, a new
 * scene-beat run never shows the last run's progress, and the toolbar's
 * format and block state follow format changes made without moving the caret.
 */

test.describe.configure({ mode: "serial" });

const chapterIdOf = (page: Page) => new URL(page.url()).pathname.split("/").pop() as string;

test("chapter details: saving a title edit keeps a summary that landed while the sheet was open", async ({ page }) => {
    await createStoryAndChapter(page, "Audit — details", "One");
    await typeInEditor(page, "The lighthouse keeper counted ships.");
    await waitForSaved(page);
    const url = `/api/chapters/${chapterIdOf(page)}`;
    await page.request.put(url, { data: { summary: "Old summary." } });
    await page.reload();
    await expect(editorLocator(page)).toContainText("lighthouse keeper");

    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByRole("button", { name: "Edit One details" }).click();
    const sheet = page.getByRole("dialog", { name: "Chapter details" });
    await expect(sheet.getByLabel("Summary", { exact: true })).toHaveValue("Old summary.");

    // A background summary lands while the sheet is open
    const before = await (await page.request.get(url)).json();
    await page.request.put(url, {
        data: { summary: "Fresh summary.", summarySourceRevision: before.revision ?? 0 }
    });

    await sheet.getByLabel("Chapter title", { exact: true }).fill("The Keeper");
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByText("The Keeper")).toBeVisible();

    const after = await (await page.request.get(url)).json();
    expect(after.title).toBe("The Keeper");
    expect(after.summary).toBe("Fresh summary.");
    expect(after.summaryLocked).toBeFalsy();
});

const frame = (event: string, data: object) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

test("scene beat: a new run starts its own progress, not the last run's", async ({ page }) => {
    const held: Route[] = [];
    let calls = 0;
    await page.route("**/api/generate/action", route => {
        if (calls++ === 0)
            return route.fulfill({
                status: 200,
                contentType: "text/event-stream",
                body:
                    frame("status", { phase: "thinking", elapsedMs: 37_000 }) +
                    frame("token", { text: "The storm broke at midnight." }) +
                    frame("finish", {})
            });
        // The second run hears nothing yet
        held.push(route);
        return undefined;
    });

    await createStoryAndChapter(page, "Audit — beat progress", "One");
    await typeInEditor(page, "Setup.");
    await page.getByRole("button", { name: "Insert scene beat" }).click();
    await page.getByPlaceholder("Describe what happens in this beat…").fill("A storm hits");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("The storm broke at midnight.")).toBeVisible();

    await page.getByRole("button", { name: "New take" }).click();
    await expect.poll(() => held.length).toBe(1);
    const progress = page.getByRole("status").filter({ hasText: /Waiting|working on it/ });
    await expect(progress).toContainText("Waiting for the model server to respond… 0s");
    await expect(progress).not.toContainText("working on it");
    await page.getByRole("button", { name: "Stop" }).click();
});

test("toolbar: Bold and Italic show what the next typing will be; block format shows the change", async ({ page }) => {
    await createStoryAndChapter(page, "Audit — toolbar", "One");
    await typeInEditor(page, "Plain start. ");
    const bold = page.getByRole("button", { name: "bold", exact: true });
    const italic = page.getByRole("button", { name: "italic", exact: true });
    await expect(bold).toHaveAttribute("data-active", "false");

    // Keystrokes with a collapsed caret
    await page.keyboard.press("Control+b");
    await expect(bold).toHaveAttribute("data-active", "true");
    await page.keyboard.type("heavy");
    await expect(editorLocator(page).locator("strong", { hasText: "heavy" })).toBeVisible();
    await page.keyboard.press("Control+b");
    await expect(bold).toHaveAttribute("data-active", "false");
    await page.keyboard.press("Control+i");
    await expect(italic).toHaveAttribute("data-active", "true");
    await page.keyboard.type("slanted");
    await expect(editorLocator(page).locator("em", { hasText: "slanted" })).toBeVisible();
    await page.keyboard.press("Control+i");
    await expect(italic).toHaveAttribute("data-active", "false");

    // The toolbar button itself, caret still collapsed
    await bold.click();
    await expect(bold).toHaveAttribute("data-active", "true");
    await bold.click();
    await expect(bold).toHaveAttribute("data-active", "false");

    // Block format: the select reflects the change made through it
    await page.getByRole("button", { name: "More tools" }).first().click();
    await expect(page.getByLabel("Block format")).toHaveValue("paragraph");
    await page.getByLabel("Block format").selectOption("h2");
    await expect(editorLocator(page).locator("h2", { hasText: "Plain start." })).toBeVisible();
    await page.getByRole("button", { name: "More tools" }).first().click();
    await expect(page.getByLabel("Block format")).toHaveValue("h2");
});
