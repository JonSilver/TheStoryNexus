import { expect, type Page, test } from "@playwright/test";
import { createStoryAndChapter } from "./helpers";

const openChapters = async (page: Page) => {
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Chapters" }).click();
};

const addChapter = async (page: Page, title: string) => {
    await openChapters(page);
    await page.getByPlaceholder("New chapter title (optional)").fill(title);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.locator('div[contenteditable="true"]')).toBeVisible();
};

/** Chapters' places as the server holds them — two sharing one makes the running order arbitrary. */
const storedOrders = async (page: Page) => {
    const storyId = new URL(page.url()).pathname.split("/")[2];
    const chapters = (await (await page.request.get(`/api/chapters/story/${storyId}`)).json()) as Array<{
        order: number;
    }>;
    return chapters.map(c => c.order);
};
const allDistinct = (values: number[]) => new Set(values).size === values.length;

const listedTitles = (page: Page) =>
    page
        .getByRole("button", { name: /^Edit .+ details$/ })
        .evaluateAll(buttons =>
            buttons.map(b => (b.getAttribute("aria-label") ?? "").replace(/^Edit (.+) details$/, "$1"))
        );

test("chapters keep one running order: added after a deletion, moved, and still so after a reload", async ({
    page
}) => {
    await createStoryAndChapter(page, "Journey — chapter order", "One");
    await addChapter(page, "Two");
    await addChapter(page, "Three");
    await openChapters(page);
    await page.getByRole("button", { name: "Delete Two" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("button", { name: "Edit Two details" })).toHaveCount(0);

    // A new chapter goes last, never into a place a deletion left
    await addChapter(page, "Four");
    expect(allDistinct(await storedOrders(page))).toBe(true);
    await openChapters(page);
    expect(await listedTitles(page)).toEqual(["One", "Three", "Four"]);

    await page.getByRole("button", { name: "Move Four up" }).click();
    await expect.poll(() => listedTitles(page)).toEqual(["One", "Four", "Three"]);

    await page.reload();
    await openChapters(page);
    await expect.poll(() => listedTitles(page)).toEqual(["One", "Four", "Three"]);
    expect(allDistinct(await storedOrders(page))).toBe(true);
});

test("a failed save says so once, not twice", async ({ page }) => {
    await createStoryAndChapter(page, "Journey — one failure, one message", "One");
    await openChapters(page);
    await page.route(/\/api\/chapters\/[^/]+$/, route =>
        route.request().method() === "PUT"
            ? route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Disk full"}' })
            : route.continue()
    );
    await page.getByRole("button", { name: "Edit One details" }).click();
    await page.getByLabel("Outline").fill("Elinor learns the truth.");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Couldn't save the chapter: Disk full")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: /save/i })).toHaveCount(1);
    // The edit is still there to try again
    await expect(page.getByLabel("Outline")).toHaveValue("Elinor learns the truth.");
});
