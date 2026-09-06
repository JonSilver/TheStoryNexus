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

test("whole-story extraction: every chapter feeds one review list", async ({ page }) => {
    const byChapter: Record<string, string> = {};
    await mockGeneration(page, () => {
        // Distinct entity per chapter proves each chapter was actually read
        const call = Object.keys(byChapter).length + 1;
        const name = call === 1 ? "Elinor" : "Willoughby";
        byChapter[String(call)] = name;
        return JSON.stringify([
            { name, category: "character", description: `${name} appears in chapter ${call}.`, tags: [] }
        ]);
    });

    await createStoryAndChapter(page, "Journey — sweep", "One");
    await typeInEditor(page, "Elinor considered the matter carefully.");
    await waitForSaved(page);
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByPlaceholder("New chapter title (optional)").fill("Two");
    await page.getByRole("button", { name: "Add" }).click();
    await typeInEditor(page, "Willoughby arrived without warning.");
    await waitForSaved(page);

    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible (AI extraction)" }).click();
    await page.getByRole("button", { name: "Extract from whole story" }).click();
    await page.getByRole("button", { name: "Run" }).click();

    // Both chapters' entities in ONE review list, pre-ticked
    await expect(page.getByText("Elinor appears in chapter 1.")).toBeVisible();
    await expect(page.getByText("Willoughby appears in chapter 2.")).toBeVisible();
    await page.getByRole("button", { name: "Add 2 to bible" }).click();

    await expect(page.getByRole("heading", { name: "character" })).toBeVisible();
    await expect(page.getByText("Elinor appears in chapter 1.")).toBeVisible();
    await expect(page.getByText("Willoughby appears in chapter 2.")).toBeVisible();
});

test("series: join from story details, grouped in Stories, bible inherits", async ({ page }) => {
    await createStoryAndChapter(page, "Journey — series", "One");
    await page.getByRole("button", { name: "More", exact: true }).click();

    page.once("dialog", dialog => void dialog.accept("The Dashwood Saga"));
    await page.getByLabel("Series").selectOption("__new__");
    await expect(page.getByText("joined the new series")).toBeVisible();
    await expect(page.getByText("Series bible entries are included")).toBeVisible();

    // Stories screen groups under the series heading
    await page.getByRole("button", { name: "Stories" }).click();
    await expect(page.getByRole("heading", { name: "The Dashwood Saga" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Journey — series" })).toBeVisible();
});

test("bible entries: manual create and edit, no AI required", async ({ page }) => {
    await createStoryAndChapter(page, "Journey — manual bible", "One");
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible (AI extraction)" }).click();

    await page.getByRole("button", { name: "New entry" }).click();
    await page.getByLabel("Entry name").fill("Mrs Jennings");
    await page.getByLabel("Description").fill("A good-humoured meddler.");
    await page.getByLabel("Tags").fill("the meddler");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("A good-humoured meddler.")).toBeVisible();
    await expect(page.getByText("aka: the meddler")).toBeVisible();

    await page.getByRole("button", { name: "Edit Mrs Jennings" }).click();
    await page.getByLabel("Description").fill("A good-humoured meddler with a sharp eye.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("A good-humoured meddler with a sharp eye.")).toBeVisible();
});

test("chapter details: POV, outline and summary are editable and stick", async ({ page }) => {
    await createStoryAndChapter(page, "Journey — chapter details", "One");
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByRole("button", { name: "Edit One details" }).click();
    await page.getByLabel("Chapter POV type").selectOption("First Person");
    await page.getByLabel("Outline").fill("Elinor learns the truth.");
    await page.getByLabel("Summary").fill("A hand-written summary.");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await page.reload();
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByRole("button", { name: "Edit One details" }).click();
    await expect(page.getByLabel("Chapter POV type")).toHaveValue("First Person");
    await expect(page.getByLabel("Outline")).toHaveValue("Elinor learns the truth.");
    await expect(page.getByLabel("Summary")).toHaveValue("A hand-written summary.");
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
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: "Brainstorm" }).click();
    await page.getByRole("button", { name: "New chat" }).click();
    await page.getByPlaceholder("Bounce an idea around…").fill("When should the storm arrive?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("The storm should arrive in chapter two.")).toBeVisible();

    page.once("dialog", dialog => void dialog.accept("The Storm"));
    await page.getByRole("button", { name: "New chapter from this" }).click();
    await expect(page.getByText("created with this as its outline")).toBeVisible();

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
