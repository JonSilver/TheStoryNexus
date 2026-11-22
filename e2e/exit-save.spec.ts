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

    // An export made now can't include them, and says so rather than leaving them out quietly
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByText("Export", { exact: true }).click();
    await page.getByRole("button", { name: "Markdown" }).click();
    const warning = page.getByRole("alertdialog");
    await expect(warning).toContainText("Your last edits to “First” haven't been saved, so they won't be included");
    await warning.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Write", exact: true }).click();
    await expect(editorLocator(page)).toBeVisible();

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

test("leaving a chapter whose save conflicted keeps the words typed since and reopens on them, never stuck saving", async ({
    page
}) => {
    await createStoryAndChapter(page, "Journey — conflict exit", "First");
    const firstId = new URL(page.url()).pathname.split("/")[4];
    await addChapter(page, "Second");
    await chapterSelect(page).selectOption({ label: "First" });
    await expect(chapterSelect(page)).toHaveValue(firstId);

    // Another device saves the chapter: this editor's next save is stale
    const stored = (await (await page.request.get(`/api/chapters/${firstId}`)).json()) as {
        content: string;
        saveVersion: number;
    };
    const elsewhere = JSON.stringify({
        root: {
            type: "root",
            version: 1,
            direction: null,
            format: "",
            indent: 0,
            children: [
                {
                    type: "paragraph",
                    version: 1,
                    direction: null,
                    format: "",
                    indent: 0,
                    textFormat: 0,
                    textStyle: "",
                    children: [
                        {
                            type: "text",
                            version: 1,
                            text: "Elsewhere.",
                            format: 0,
                            detail: 0,
                            mode: "normal",
                            style: ""
                        }
                    ]
                }
            ]
        }
    });
    expect(
        (
            await page.request.put(`/api/chapters/${firstId}`, {
                data: { content: elsewhere, wordCount: 1, expectedSaveVersion: stored.saveVersion }
            })
        ).ok()
    ).toBe(true);

    // The stale save is slow to answer, and the writer keeps typing meanwhile
    await page.route(`**/api/chapters/${firstId}`, async route => {
        if (route.request().method() === "PUT") await new Promise(resolve => setTimeout(resolve, 1500));
        await route.fallback();
    });
    await editorLocator(page).click();
    const firstSave = page.waitForRequest(r => r.method() === "PUT" && r.url().endsWith(`/api/chapters/${firstId}`));
    await page.keyboard.type("Typed before.");
    await firstSave;
    await page.keyboard.type(" Typed during.");
    await expect(page.getByText("This chapter was changed elsewhere.")).toBeVisible();

    await chapterSelect(page).selectOption({ label: "Second" });
    await expect(page.getByText(/Your last edits to “First” weren't saved: it was changed elsewhere/)).toBeVisible();

    await chapterSelect(page).selectOption({ label: "First" });
    await expect(editorLocator(page)).toContainText("Typed before. Typed during.");
    await expect(page.getByText("This chapter was changed elsewhere.")).toBeVisible();
    await expect(page.getByText(/Your last edits to “First” weren't saved/)).toHaveCount(0);

    // Leaving again still keeps the unsaved version; an export says it's missing and doesn't hang
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByText("Export", { exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Text" }).click();
    const warning = page.getByRole("alertdialog");
    await expect(warning).toContainText("Your last edits to “First” haven't been saved");
    await warning.getByRole("button", { name: "Export anyway" }).click();
    expect((await download).suggestedFilename()).toBe("Journey-conflict-exit.txt");
});
