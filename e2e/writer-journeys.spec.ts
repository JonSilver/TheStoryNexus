import { expect, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator, mockGeneration, typeInEditor, waitForSaved } from "./helpers";

/**
 * Journey tests: each asserts the writer-visible OUTCOME a control promises,
 * not that machinery ran. AI is mocked at the network layer (deterministic
 * SSE); everything else is the real stack on a fresh database.
 */

test.describe.configure({ mode: "serial" });

test("typing autosaves and survives a reload", async ({ page }) => {
    await createStoryAndChapter(page, "Journey — autosave", "One");
    await typeInEditor(page, "The night ferry left without her.");
    await waitForSaved(page);
    await page.reload();
    await expect(editorLocator(page)).toContainText("The night ferry left without her.");
});

test("scene beat: generate, second take, navigate, accept into prose", async ({ page }) => {
    const takes = ["First take: the storm broke at midnight.", "Second take: the storm never came."];
    let calls = 0;
    await mockGeneration(page, () => takes[Math.min(calls++, takes.length - 1)]);

    await createStoryAndChapter(page, "Journey — beats", "One");
    await typeInEditor(page, "Setup paragraph.");
    await page.getByRole("button", { name: "Insert scene beat" }).click();
    await page.getByPlaceholder("Describe what happens in this beat…").fill("A storm hits the harbour");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText(takes[0])).toBeVisible();

    // A second take must never destroy the first
    await page.getByRole("button", { name: "New take" }).click();
    await expect(page.getByText(takes[1])).toBeVisible();
    await expect(page.getByText("2/2")).toBeVisible();
    await page.getByRole("button", { name: "Previous take" }).click();
    await expect(page.getByText(takes[0])).toBeVisible();

    // Accept inserts the ACTIVE take (take one) as prose
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(editorLocator(page).locator("p", { hasText: takes[0] })).toBeVisible();
    await waitForSaved(page);
    await page.reload();
    await expect(editorLocator(page)).toContainText(takes[0]);
});

test("ghost continue: keep converts to prose; dismiss removes", async ({ page }) => {
    await mockGeneration(page, () => "She counted the lights along the pier.");

    await createStoryAndChapter(page, "Journey — ghost", "One");
    await typeInEditor(page, "The evening settled in.");
    await page.getByRole("button", { name: "Continue writing" }).click();
    await expect(page.getByText("She counted the lights along the pier.")).toBeVisible();
    await page.getByRole("button", { name: "Keep" }).click();
    await expect(editorLocator(page).locator("p", { hasText: "She counted the lights" })).toBeVisible();
    await waitForSaved(page);
    await page.reload();
    await expect(editorLocator(page)).toContainText("She counted the lights along the pier.");

    // Dismiss leaves no trace
    await page.getByRole("button", { name: "Continue writing" }).click();
    await expect(page.getByRole("button", { name: "Dismiss" })).toBeVisible();
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByRole("button", { name: "Keep" })).toHaveCount(0);
});

test("nudge chip: Add to bible actually adds entries", async ({ page }) => {
    await mockGeneration(page, request =>
        request.actionId === "extract_entries"
            ? JSON.stringify([
                  {
                      name: "Okonkwo",
                      category: "character",
                      description: "The mainland boatman everyone trusts.",
                      tags: ["the boatman"]
                  }
              ])
            : "unused"
    );

    await page.clock.install();
    await createStoryAndChapter(page, "Journey — nudges", "One");
    await typeInEditor(
        page,
        "The radio crackled and Okonkwo answered from the mainland. She trusted Okonkwo completely. If anyone could reach the tug it was Okonkwo, whose boat was fuelled."
    );
    // Name detection debounces 8s
    await page.clock.runFor(10_000);
    await expect(page.getByText("New name spotted:")).toBeVisible();

    await page.getByRole("button", { name: "Add to bible" }).click();
    // Arrival auto-runs a focused extraction; proposals are pre-ticked
    await expect(page.getByText("The mainland boatman everyone trusts.")).toBeVisible();
    await page.getByRole("button", { name: "Add 1 to bible" }).click();

    // The promise: the entry EXISTS in the bible afterwards
    await expect(page.getByRole("heading", { name: "character" })).toBeVisible();
    await expect(page.getByText("Okonkwo")).toBeVisible();
    await expect(page.getByText("The mainland boatman everyone trusts.")).toBeVisible();
});

test("brainstorm: reply appears and survives a reload", async ({ page }) => {
    await mockGeneration(page, () => "What if the ferry never existed at all?");

    await createStoryAndChapter(page, "Journey — brainstorm", "One");
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: "Brainstorm" }).click();
    await page.getByRole("button", { name: "New chat" }).click();
    await page.getByPlaceholder("Bounce an idea around…").fill("Give me a twist");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("What if the ferry never existed at all?")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: "Brainstorm" }).click();
    await page.getByRole("button", { name: /^Chat 1/ }).click();
    await expect(page.getByText("What if the ferry never existed at all?")).toBeVisible();
});

test("import: pasted manuscript becomes a story with chapters", async ({ page }) => {
    await page.goto("/v2");
    await page.getByRole("button", { name: "Stories" }).click();
    await page.getByRole("button", { name: "Import" }).click();
    await page
        .getByPlaceholder("Paste your manuscript here…")
        .fill("Chapter 1\n\nThe tide was wrong that morning.\n\nChapter 2\n\nBy noon the harbour was empty.");
    await page.getByRole("button", { name: "Analyse pasted text" }).click();
    await expect(page.getByText(/Chapter 2/).first()).toBeVisible();
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
    await page.getByRole("button", { name: "More", exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Markdown" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const content = Buffer.concat(chunks).toString("utf-8");
    if (!content.includes("Exportable sentence about the tide.")) throw new Error(`Export missing prose: ${content}`);
});
