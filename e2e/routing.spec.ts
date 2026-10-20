import { expect, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator, typeInEditor, waitForSaved } from "./helpers";

/**
 * The URL says where the writer is (#81): browser back/forward move between
 * in-app screens, refresh keeps the place, and links work on their own.
 */

test.describe.configure({ mode: "serial" });

test("back and forward move between screens without leaving the app", async ({ page }) => {
    await createStoryAndChapter(page, "Routing — history", "One");
    await expect(page).toHaveURL(/\/story\/[^/]+\/write\/[^/]+$/);

    await page.getByRole("button", { name: "Story", exact: true }).click();
    await expect(page).toHaveURL(/\/story\/[^/]+$/);
    await page.getByRole("button", { name: "Story Bible" }).click();
    await expect(page).toHaveURL(/\/story\/[^/]+\/bible$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/story\/[^/]+$/);
    await expect(page.getByRole("button", { name: "Story Bible" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/write\//);
    await expect(editorLocator(page)).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/story\/[^/]+$/);

    // The in-app back arrow behaves like history back
    await page.getByRole("button", { name: "Story Bible" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/story\/[^/]+$/);
});

test("refresh keeps the writer on the same chapter, and a copied link opens it", async ({ page, context }) => {
    await createStoryAndChapter(page, "Routing — refresh", "First");
    await typeInEditor(page, "Text in the first chapter.");
    await waitForSaved(page);
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByPlaceholder("New chapter title (optional)").fill("Second");
    await page.getByRole("button", { name: "Add" }).click();
    await typeInEditor(page, "Text in the second chapter.");
    await waitForSaved(page);
    const secondChapterUrl = page.url();

    await page.reload();
    await expect(page).toHaveURL(secondChapterUrl);
    await expect(editorLocator(page)).toContainText("Text in the second chapter.");

    // Switching chapter is a history step too
    await page.getByLabel("Chapter", { exact: true }).selectOption({ label: "First" });
    await expect(editorLocator(page)).toContainText("Text in the first chapter.");
    await page.goBack();
    await expect(editorLocator(page)).toContainText("Text in the second chapter.");

    // A link opened fresh (e.g. on another device) lands on that chapter
    const other = await context.newPage();
    await other.goto(secondChapterUrl);
    await expect(editorLocator(other)).toContainText("Text in the second chapter.");

    // A link to a chapter that no longer exists opens a real one, and the address says which
    const storyWrite = secondChapterUrl.replace(/\/write\/[^/]+$/, "/write");
    await other.goto(`${storyWrite}/no-such-chapter`);
    await expect(editorLocator(other)).toBeVisible();
    await expect(other).not.toHaveURL(/no-such-chapter/);
    await expect(other).toHaveURL(/\/write\/[^/]+$/);
});

test("a brainstorm chat has its own URL", async ({ page }) => {
    await createStoryAndChapter(page, "Routing — brainstorm", "One");
    await page.getByRole("button", { name: "Brainstorm" }).click();
    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page).toHaveURL(/\/brainstorm\/[^/]+$/);
    const chatUrl = page.url();
    await page.reload();
    await expect(page).toHaveURL(chatUrl);
    await expect(page.getByRole("button", { name: "Back to chats" })).toBeVisible();
});

test("an unknown story in the URL says so and offers the library", async ({ page }) => {
    await page.goto("/story/no-such-story/write");
    await expect(page.getByText("That story doesn't exist")).toBeVisible();
    await page.getByRole("button", { name: "Open the library" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByPlaceholder("New story title")).toBeVisible();
});

test("a chapter the server won't return says so and offers to try again", async ({ page }) => {
    await createStoryAndChapter(page, "Routing — chapter load failure", "One");
    const chapterUrl = page.url();
    const chapterApi = /\/api\/chapters\/[^/]+$/;
    await page.route(chapterApi, route =>
        route.request().method() === "GET" ? route.fulfill({ status: 503, body: "" }) : route.continue()
    );
    await page.reload();
    await expect(page.getByText(/Couldn't open this chapter/)).toBeVisible({ timeout: 15_000 });
    await page.unroute(chapterApi);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(editorLocator(page)).toBeVisible();
    await expect(page).toHaveURL(chapterUrl);
});

test("every screen about a story names it; tab screens have no back, the screens under them do", async ({ page }) => {
    await createStoryAndChapter(page, "Context — Ashford", "One");
    const header = page.locator("header");
    const back = page.getByRole("button", { name: /^Back/ });

    await page.getByRole("button", { name: "Brainstorm" }).click();
    await expect(header.getByRole("heading", { name: "Brainstorm" })).toBeVisible();
    await expect(header.getByText("Context — Ashford")).toBeVisible();
    await expect(back).toHaveCount(0);

    for (const screen of ["Chapters", "Story Bible", "Notes"]) {
        await page.getByRole("button", { name: "Story", exact: true }).click();
        await page.getByRole("button", { name: screen }).click();
        await expect(header.getByRole("heading", { name: screen })).toBeVisible();
        await expect(header.getByText("Context — Ashford")).toBeVisible();
        await expect(back).toHaveCount(1);
    }

    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Switch story" }).click();
    await expect(back).toHaveCount(1);

    // Per-story AI settings say which story
    await page.goto("/settings/actions");
    await expect(page.getByRole("button", { name: "This story: Context — Ashford" })).toBeEnabled();
});
