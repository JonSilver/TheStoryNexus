import { expect, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator, typeInEditor, waitForSaved } from "./helpers";

/**
 * Duplicate makes an independent copy in one step: everything a backup
 * carries — chapters, bible, notes, images, per-story AI settings — and,
 * unlike a restore, the same series. Editing the copy never touches the original.
 */

// A 1×1 transparent PNG
const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64"
);

test("duplicate a story: the copy has its bible, notes, images and series; editing it leaves the original alone", async ({
    page
}) => {
    await createStoryAndChapter(page, "Duplicate — original", "One");
    const storyId = new URL(page.url()).pathname.split("/")[2];
    await typeInEditor(page, "The original opening.");
    await waitForSaved(page);

    const series = await (await page.request.post("/api/series", { data: { name: "The Whitwell Books" } })).json();
    await page.request.put(`/api/stories/${storyId}`, { data: { seriesId: series.id } });
    await page.request.post("/api/lorebook", {
        data: {
            level: "story",
            scopeId: storyId,
            name: "Aunt Hester",
            description: "Formidable.",
            category: "character",
            tags: []
        }
    });
    await page.request.post("/api/notes", {
        data: { storyId, title: "Ending idea", content: "She stays.", type: "idea" }
    });
    const image = await page.request.post(`/api/assets/${storyId}`, {
        multipart: { file: { name: "map.png", mimeType: "image/png", buffer: PNG } }
    });
    expect(image.ok()).toBe(true);
    const { url: imageUrl } = (await image.json()) as { url: string };
    await page.request.put("/api/actions/overrides", {
        data: { actionId: "rework", storyId, temperature: 0.4 }
    });

    await page.goto(`/story/${storyId}`);
    await expect(page.getByRole("heading", { name: "Duplicate — original" })).toBeVisible();
    await page.getByRole("button", { name: "Duplicate this story…" }).click();
    const title = page.getByLabel("Title of the copy");
    await expect(title).toHaveValue("Duplicate — original (copy)");
    await title.fill("Duplicate — the copy");
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();

    // Lands in the copy's hub, still in the series
    await expect(page.getByRole("heading", { name: "Duplicate — the copy" })).toBeVisible();
    const copyId = new URL(page.url()).pathname.split("/")[2];
    expect(copyId).not.toBe(storyId);
    await expect(page.locator("header").getByText(/The Whitwell Books/)).toBeVisible();

    await page.getByRole("button", { name: /Story Bible/ }).click();
    await expect(page.getByText("Aunt Hester")).toBeVisible();
    await page.goto(`/story/${copyId}/notes`);
    await expect(page.getByText("Ending idea")).toBeVisible();
    const copiedImage = await page.request.get(imageUrl.replace(`/api/assets/${storyId}/`, `/api/assets/${copyId}/`));
    expect(copiedImage.ok()).toBe(true);
    const [override] = await (await page.request.get(`/api/actions/overrides?storyId=${copyId}`)).json();
    expect(override).toMatchObject({ actionId: "rework", temperature: 0.4 });

    // Editing the copy leaves the original as it was
    await page.goto(`/story/${copyId}/write`);
    await expect(editorLocator(page)).toContainText("The original opening.");
    await typeInEditor(page, " Only in the copy.");
    await waitForSaved(page);
    await page.goto(`/story/${storyId}/write`);
    await expect(editorLocator(page)).toContainText("The original opening.");
    await expect(editorLocator(page)).not.toContainText("Only in the copy.");
    // And the original keeps its own bible
    await page.goto(`/story/${storyId}/bible`);
    await expect(page.getByText("Aunt Hester")).toBeVisible();
});
