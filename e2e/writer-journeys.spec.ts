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
    const seenRequests: Array<Record<string, unknown>> = [];
    let calls = 0;
    await mockGeneration(page, request => {
        seenRequests.push(request.editorContext ?? {});
        return takes[Math.min(calls++, takes.length - 1)];
    });

    await createStoryAndChapter(page, "Journey — beats", "One");
    await typeInEditor(page, "Setup paragraph.");
    await page.getByRole("button", { name: "Insert scene beat" }).click();
    await page.getByPlaceholder("Describe what happens in this beat…").fill("A storm hits the harbour");
    // The per-beat POV picker must steer generation, not just persist state
    await page.getByLabel("POV type").selectOption("First Person");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText(takes[0])).toBeVisible();
    if (seenRequests[0]?.povType !== "First Person")
        throw new Error(`Beat generation ignored the POV picker: ${JSON.stringify(seenRequests[0])}`);

    // A second take must never destroy the first
    await page.getByRole("button", { name: "New take" }).click();
    await expect(page.getByText(takes[1])).toBeVisible();
    await expect(page.getByText("Take 2 of 2")).toBeVisible();
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

test("brainstorm: reply appears and survives a reload", async ({ page }) => {
    await mockGeneration(page, () => "**What if** the ferry never existed at all?");

    await createStoryAndChapter(page, "Journey — brainstorm", "One");
    await page.getByRole("button", { name: "Brainstorm" }).click();
    await page.getByRole("button", { name: "New chat" }).click();
    await page.getByPlaceholder("Bounce an idea around…").fill("Give me a twist");
    await page.getByRole("button", { name: "Send" }).click();
    // Markdown renders as markup, not raw asterisks
    await expect(page.locator("strong", { hasText: "What if" })).toBeVisible();
    await expect(page.getByText("the ferry never existed at all?")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Brainstorm" }).click();
    await page.getByRole("button", { name: /^Chat 1/ }).click();
    await expect(page.getByText("the ferry never existed at all?")).toBeVisible();
});

test("chapter details: POV, outline and summary are editable and stick", async ({ page }) => {
    await createStoryAndChapter(page, "Journey — chapter details", "One");
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByRole("button", { name: "Edit One details" }).click();
    await page.getByLabel("Chapter POV type").selectOption("First Person");
    await page.getByLabel("Outline").fill("Elinor learns the truth.");
    await page.getByLabel("Summary", { exact: true }).fill("A hand-written summary.");
    // Closing with unsaved edits asks first; keeping them loses nothing
    await page.keyboard.press("Escape");
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByLabel("Outline")).toHaveValue("Elinor learns the truth.");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await page.reload();
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByRole("button", { name: "Edit One details" }).click();
    await expect(page.getByLabel("Chapter POV type")).toHaveValue("First Person");
    await expect(page.getByLabel("Outline")).toHaveValue("Elinor learns the truth.");
    await expect(page.getByLabel("Summary", { exact: true })).toHaveValue("A hand-written summary.");
});

test("selection right-click shows the app's own menu, not the browser's", async ({ page }) => {
    await mockGeneration(page, () => "Reworked sentence.");
    await createStoryAndChapter(page, "Journey — context menu", "One");
    await typeInEditor(page, "A sentence worth improving.");
    await page.keyboard.press("Control+A");
    await editorLocator(page).click({ button: "right" });
    await expect(page.getByRole("menu", { name: "Selection actions" })).toBeVisible();
    await page.getByRole("menu").getByText("Rework").click();
    await expect(page.getByText("Reworked sentence.")).toBeVisible();
});

test("brainstorm reply becomes a chapter outline", async ({ page }) => {
    await mockGeneration(page, () => "The storm should arrive in chapter two.");
    await createStoryAndChapter(page, "Journey — bridge", "One");
    await page.getByRole("button", { name: "Brainstorm" }).click();
    await page.getByRole("button", { name: "New chat" }).click();
    await page.getByPlaceholder("Bounce an idea around…").fill("When should the storm arrive?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("The storm should arrive in chapter two.")).toBeVisible();

    await page.getByRole("button", { name: "New chapter from this" }).click();
    await page.getByLabel("Chapter title").fill("The Storm");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("created with this as its outline")).toBeVisible();

    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByRole("button", { name: "Edit The Storm details" }).click();
    await expect(page.getByLabel("Outline")).toHaveValue("The storm should arrive in chapter two.");
});

test("context menu clipboard: cut, copy and paste round-trip", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await createStoryAndChapter(page, "Journey — clipboard", "One");
    await typeInEditor(page, "Words to carry elsewhere.");

    await page.keyboard.press("Control+A");
    await editorLocator(page).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Copy" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    if (!copied.includes("Words to carry elsewhere.")) throw new Error(`Copy failed: "${copied}"`);

    await page.keyboard.press("Control+A");
    await editorLocator(page).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Cut" }).click();
    await expect(editorLocator(page)).not.toContainText("Words to carry elsewhere.");

    // Paste replaces a selection (with nothing selected the browser's own
    // menu — which has native paste — is deliberately left in charge)
    await typeInEditor(page, "placeholder");
    await page.keyboard.press("Control+A");
    await editorLocator(page).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Paste" }).click();
    await expect(editorLocator(page)).toContainText("Words to carry elsewhere.");
    await expect(editorLocator(page)).not.toContainText("placeholder");
});

test("reference panel: bible lookup and quick note without leaving the page", async ({ page }) => {
    await createStoryAndChapter(page, "Journey — reference", "One");
    // Seed one bible entry via the hub
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();
    await page.getByRole("button", { name: "New entry" }).click();
    await page.getByLabel("Entry name").fill("Colonel Brandon");
    await page.getByLabel("Description").fill("Steady, quiet, thirty-five.");
    await page.getByRole("button", { name: "Save" }).click();

    // Back to writing; the panel answers without navigation
    await page.getByRole("button", { name: "Write" }).click();
    await page.getByRole("button", { name: "Reference panel" }).click();
    await page.getByLabel("Search the bible").fill("brandon");
    await page.getByText("Colonel Brandon").click();
    await expect(page.getByText("Steady, quiet, thirty-five.")).toBeVisible();
    // The manuscript is still there behind the panel
    await expect(editorLocator(page)).toBeVisible();

    await page.getByRole("textbox", { name: "Quick note" }).fill("Brandon should appear earlier.");
    await page.getByRole("button", { name: "Save quick note" }).click();
    await page.getByRole("button", { name: "Close reference panel" }).click();

    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Notes" }).click();
    await expect(page.getByText("Brandon should appear earlier.").first()).toBeVisible();
});

test("read: the whole story renders inside the shell", async ({ page }) => {
    await createStoryAndChapter(page, "Journey — read", "One");
    await typeInEditor(page, "A sentence destined for the reader.");
    await waitForSaved(page);
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Read" }).click();
    await expect(page.getByText("A sentence destined for the reader.")).toBeVisible();
    // Still in the shell: bottom nav present, back returns to the hub
    await expect(page.getByRole("button", { name: "Write" })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("button", { name: "Chapters" })).toBeVisible();
});
