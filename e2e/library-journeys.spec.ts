import { expect, test } from "@playwright/test";
import { createStoryAndChapter, typeInEditor, waitForSaved } from "./helpers";

/**
 * Library and navigation journeys: stories in (import) and out (export,
 * delete), and settings screens that stay inside the app. Real stack on a
 * fresh database.
 */

test.describe.configure({ mode: "serial" });

test("import: pasted manuscript becomes a story with chapters", async ({ page }) => {
    await page.goto("/v2");
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Open the library" }).click();
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await page
        .getByPlaceholder("Paste your manuscript here…")
        .fill("Chapter 1\n\nThe tide was wrong that morning.\n\nChapter 2\n\nBy noon the harbour was empty.");
    await page.getByRole("button", { name: "Analyse pasted text" }).click();
    await expect(page.getByText("2 of 2 chapters selected")).toBeVisible();
    await page.getByRole("button", { name: /Create story/ }).click();

    // The promise: a real story with real chapters, opened for writing
    await expect(page.getByPlaceholder("New chapter title (optional)")).toBeVisible();
    await expect(page.getByText("Chapter 1")).toBeVisible();
    await expect(page.getByText("Chapter 2")).toBeVisible();
});

test("export: markdown download contains the chapter text", async ({ page }) => {
    await createStoryAndChapter(page, "Journey — export", "One");
    await typeInEditor(page, "Exportable sentence about the tide.");
    await waitForSaved(page);
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByText("Export", { exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Markdown" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const content = Buffer.concat(chunks).toString("utf-8");
    if (!content.includes("Exportable sentence about the tide.")) throw new Error(`Export missing prose: ${content}`);
});

test("import: multiple files become one story in filename order", async ({ page }) => {
    await page.goto("/v2");
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Open the library" }).click();
    await page.getByRole("button", { name: "Import", exact: true }).click();

    // Deliberately unordered selection; "part 10" must sort after "part 2"
    await page.locator('input[accept=".txt,.md,.docx,.epub"]').setInputFiles([
        { name: "part 10.txt", mimeType: "text/plain", buffer: Buffer.from("The final reckoning arrived.") },
        { name: "part 2.txt", mimeType: "text/plain", buffer: Buffer.from("The middle held its breath.") },
        { name: "part 1.txt", mimeType: "text/plain", buffer: Buffer.from("It began on a Tuesday.") }
    ]);

    await expect(page.getByText("3 of 3 chapters selected")).toBeVisible();
    const reviewTitles = await page.locator("input:not([type=checkbox])").evaluateAll(els =>
        els
            .filter(el => el.getAttribute("aria-label") !== "Story title")
            .map(el => (el as HTMLInputElement).value)
            .filter(v => /^part /.test(v))
    );
    if (reviewTitles.join("|") !== "part 1|part 2|part 10")
        throw new Error(`Wrong review order: ${reviewTitles.join(", ")}`);
    await page.getByRole("button", { name: /Create story \(3 chapters\)/ }).click();
    await expect(page.getByPlaceholder("New chapter title (optional)")).toBeVisible();

    // Order and per-file titles both honoured (wait for the list — allTextContents doesn't)
    await expect(page.getByRole("button", { name: /^part 10\b/ })).toBeVisible();
    const titles = await page.locator("li span.truncate").allTextContents();
    const order = titles.filter(t => /^part /.test(t));
    if (order.join("|") !== "part 1|part 2|part 10") throw new Error(`Wrong order: ${order.join(", ")}`);
});

test("delete story: confirmed, gone from the library", async ({ page }) => {
    await createStoryAndChapter(page, "Journey — doomed", "One");
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Delete this story…" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete story" }).click();
    await expect(page.getByPlaceholder("New story title")).toBeVisible();
    await expect(page.getByText("Journey — doomed")).toHaveCount(0);
});

test("settings screens stay inside the app: one back button, never out of it", async ({ page }) => {
    await page.goto("/v2");
    await page.getByRole("button", { name: "Settings" }).click();

    for (const [row, title] of [
        ["AI providers & models", "AI providers & models"],
        ["Guide", "Guide"],
        ["Series", "Series"]
    ] as const) {
        await page.getByRole("button", { name: row, exact: true }).click();
        await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
        // Exactly one back control — the app's own — and it returns to Settings
        await expect(page.getByRole("button", { name: "Back" })).toHaveCount(1);
        await page.getByRole("button", { name: "Back" }).click();
        await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
        expect(new URL(page.url()).pathname).toBe("/settings");
    }
});

test("old standalone page URLs open the right screen inside the app", async ({ page }) => {
    await page.goto("/guide");
    await expect(page.getByRole("heading", { name: "Guide", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Write" })).toBeVisible();
    await page.goto("/series");
    await expect(page.getByRole("heading", { name: "Series", exact: true })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/settings/series");
    await page.goto("/?tool=providers");
    await expect(page.getByRole("heading", { name: "AI providers & models" })).toBeVisible();
});
