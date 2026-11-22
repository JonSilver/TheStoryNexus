import { expect, type Page, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator } from "./helpers";

const chapterSelect = (page: Page) => page.getByLabel("Chapter", { exact: true });

const addChapter = async (page: Page, title: string) => {
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByPlaceholder("New chapter title (optional)").fill(title);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(editorLocator(page)).toBeVisible();
};

const storedContent = async (page: Page, chapterId: string) =>
    ((await (await page.request.get(`/api/chapters/${chapterId}`)).json()) as { content: string }).content;

test("edits whose save fails as the writer leaves the chapter are reported, kept, and saved on return", async ({
    page
}) => {
    await createStoryAndChapter(page, "Journey — exit save", "First");
    const firstId = new URL(page.url()).pathname.split("/")[4];
    await addChapter(page, "Second");
    await chapterSelect(page).selectOption({ label: "First" });
    await expect(chapterSelect(page)).toHaveValue(firstId);

    const contentPuts: string[] = [];
    const failSaves = (route: import("@playwright/test").Route) => {
        if (route.request().method() !== "PUT") return route.continue();
        contentPuts.push(route.request().url());
        return route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Disk full"}' });
    };
    await page.route(`**/api/chapters/${firstId}`, failSaves);

    await editorLocator(page).click();
    await page.keyboard.type("Words the server never took.");
    // Leave inside the save debounce: the only save is the exit save
    await chapterSelect(page).selectOption({ label: "Second" });

    await expect(page.getByText(/Your last edits to “First” couldn't be saved/)).toBeVisible({ timeout: 15_000 });
    expect(await storedContent(page, firstId)).not.toContain("Words the server never took.");

    // The closed editor stops trying: no retries nothing on screen accounts for
    const attempts = contentPuts.length;
    expect(attempts).toBeGreaterThan(0);
    await page.waitForTimeout(5_000);
    expect(contentPuts).toHaveLength(attempts);

    // The server recovers; reopening the chapter shows the text and saves it
    await page.unroute(`**/api/chapters/${firstId}`, failSaves);
    await chapterSelect(page).selectOption({ label: "First" });
    await expect(editorLocator(page)).toContainText("Words the server never took.");
    await expect.poll(() => storedContent(page, firstId)).toContain("Words the server never took.");
    await expect(page.getByText(/Your last edits to “First” couldn't be saved/)).toHaveCount(0);

    await page.reload();
    await expect(chapterSelect(page)).toHaveValue(firstId);
    await expect(editorLocator(page)).toContainText("Words the server never took.");
});
