import { expect, type Download, type Page, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator, mockGeneration, typeInEditor, waitForSaved } from "./helpers";

/**
 * Every export carries the writer's last keystrokes and warns before leaving
 * AI drafts out; a bible entry can be left out of AI context and brought back.
 */

const openExport = async (page: Page) => {
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByText("Export", { exact: true }).click();
};

const downloadedText = async (download: Download) => {
    const chunks: Buffer[] = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
};

test("JSON backup taken straight after typing contains the words just typed", async ({ page }) => {
    await createStoryAndChapter(page, "Export — fresh backup", "One");
    // A slow save: the backup must wait for it, not race it
    await page.route("**/api/chapters/*", async route => {
        if (route.request().method() === "PUT") await new Promise(resolve => setTimeout(resolve, 1500));
        await route.fallback();
    });
    await typeInEditor(page, "Words typed a heartbeat before the backup.");
    await openExport(page);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "JSON (backup)" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Export-fresh-backup.story.json");
    expect((await downloadedText(download)).toString("utf-8")).toContain("Words typed a heartbeat before the backup.");
});

test("EPUB warns about an unaccepted scene-beat take; cancelling downloads nothing", async ({ page }) => {
    await mockGeneration(page, () => "An undecided take about the lighthouse.");
    await createStoryAndChapter(page, "Export — epub drafts", "One");
    await typeInEditor(page, "Accepted prose.");
    await page.getByRole("button", { name: "Insert scene beat" }).click();
    await page.getByPlaceholder("Describe what happens in this beat…").fill("The lighthouse goes dark");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("An undecided take about the lighthouse.")).toBeVisible();
    await waitForSaved(page);

    const downloads: Download[] = [];
    page.on("download", download => downloads.push(download));
    await openExport(page);
    await page.getByRole("link", { name: "EPUB" }).click();
    const warning = page.getByRole("alertdialog");
    await expect(warning).toContainText(
        "1 unaccepted AI draft (scene-beat takes or pending suggestions) won't be included"
    );
    await warning.getByRole("button", { name: "Cancel" }).click();
    await expect(warning).toHaveCount(0);
    // Give a download that shouldn't happen time to arrive
    await page.waitForTimeout(1000);
    expect(downloads).toHaveLength(0);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "EPUB" }).click();
    await warning.getByRole("button", { name: "Export anyway" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Export-epub-drafts.epub");
    // A real e-book is a zip, not an error page
    expect((await downloadedText(download)).subarray(0, 2).toString("latin1")).toBe("PK");
});

test("a bible entry left out of AI context stays out of what gets sent, until it's switched back on", async ({
    page
}) => {
    const description = "Rourke wears a glass eye and lies about it.";
    await createStoryAndChapter(page, "Bible — left out", "One");
    // A fresh database has no AI settings row until something asks for one
    await page.request.get("/api/ai/settings");
    // The real server assembles the prompt; only the model choice is supplied, as no provider is set up here
    await page.route("**/api/generate/preview", route =>
        route.continue({
            postData: JSON.stringify({
                ...route.request().postDataJSON(),
                modelRef: { provider: "local", modelId: "local/any" }
            })
        })
    );
    await typeInEditor(page, "Captain Rourke climbed aboard.");
    await waitForSaved(page);

    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();
    await page.getByRole("button", { name: "New entry" }).click();
    await page.getByLabel("Entry name").fill("Rourke");
    await page.getByLabel("Description").fill(description);
    await page.getByLabel("Leave out of AI context").check();
    await page.getByRole("button", { name: "Save" }).click();
    const listed = page.getByRole("button", { name: "Edit Rourke" });
    await expect(listed).toContainText(description);
    await expect(listed).toContainText("Left out of AI");

    const sentToAi = async () => {
        await page.getByRole("button", { name: "Write", exact: true }).click();
        await expect(editorLocator(page)).toContainText("Captain Rourke climbed aboard.");
        await editorLocator(page).click();
        await page.keyboard.press("Control+End");
        await page.getByRole("button", { name: "Insert scene beat" }).click();
        await page.getByPlaceholder("Describe what happens in this beat…").last().fill("Rourke takes the wheel");
        await page.getByRole("button", { name: "What will be sent to the AI?" }).last().click();
        const sheet = page.getByRole("dialog", { name: "What gets sent" });
        // Anchor: the assembled prompt is showing (it carries the beat's command)
        await expect(sheet).toContainText("Rourke takes the wheel");
        const text = await sheet.innerText();
        await sheet.getByRole("button", { name: "Close" }).click();
        return text;
    };
    expect(await sentToAi()).not.toContain(description);

    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();
    await listed.click();
    await expect(page.getByLabel("Leave out of AI context")).toBeChecked();
    await page.getByLabel("Leave out of AI context").uncheck();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(listed).toContainText(description);
    await expect(listed).not.toContainText("Left out of AI");

    expect(await sentToAi()).toContain(description);
});
