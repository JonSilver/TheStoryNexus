import { expect, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator, mockGeneration, waitForSaved } from "./helpers";

/**
 * Journeys where getting it wrong destroys the writer's work: backups that
 * must restore everything, curated text that background AI must not
 * overwrite, and shared canon that one story must not rewrite.
 */

test.describe.configure({ mode: "serial" });

const openStoryHub = async (page: import("@playwright/test").Page) =>
    page.getByRole("button", { name: "Story", exact: true }).click();

test("JSON backup round-trip restores notes, not just chapters", async ({ page }, testInfo) => {
    await createStoryAndChapter(page, "Safety — backup", "One");
    await editorLocator(page).click();
    await page.keyboard.type("Prose that must survive the round trip.");
    await waitForSaved(page);

    await openStoryHub(page);
    await page.getByRole("button", { name: "Notes" }).click();
    await page.getByRole("button", { name: "New note" }).click();
    await page.getByPlaceholder("Title").fill("Tide research");
    await page.getByPlaceholder(/Write your note/).fill("Spring tides peak two days after the full moon.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Tide research")).toBeVisible();

    await openStoryHub(page);
    await page.getByText("Export", { exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "JSON (backup)" }).click();
    const backupPath = testInfo.outputPath("backup.story.json");
    await (await downloadPromise).saveAs(backupPath);

    await openStoryHub(page);
    await page.getByRole("button", { name: "Switch story" }).click();
    await page.getByLabel("Import story JSON").setInputFiles(backupPath);

    // Lands IN the restored story, with an honest confirmation
    await expect(page.getByText(/Restored “Safety — backup \(Imported\)”/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Safety — backup (Imported)" })).toBeVisible();

    await page.getByRole("button", { name: "Notes" }).click();
    await expect(page.getByText("Tide research")).toBeVisible();
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Read" }).click();
    await expect(page.getByText("Prose that must survive the round trip.")).toBeVisible();
});

test("a hand-written summary survives background auto-summarise", async ({ page }) => {
    const summariseCalls: string[] = [];
    await mockGeneration(page, request => {
        if (request.actionId === "summarise_chapter") summariseCalls.push(request.actionId);
        return "AN AI SUMMARY THAT MUST NOT APPEAR";
    });
    await page.clock.install();

    await createStoryAndChapter(page, "Safety — summary", "One");
    await editorLocator(page).click();
    // Auto-summarise ignores chapters under 150 words — clear that bar
    await page.keyboard.insertText("The harbour lights burned low along the wall. ".repeat(25));
    await page.clock.runFor(2_000);
    await waitForSaved(page);

    await openStoryHub(page);
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByRole("button", { name: "Edit One details" }).click();
    await page.getByLabel("Summary", { exact: true }).fill("My own summary: the keeper sees the ship.");
    await expect(page.getByLabel("Keep this summary")).toBeChecked();
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // A later prose edit makes the summary stale — then the idle window passes
    await page.getByRole("button", { name: "Write" }).click();
    await editorLocator(page).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" One more line.");
    await page.clock.runFor(2_000);
    await waitForSaved(page);
    await page.clock.runFor(120_000);

    expect(summariseCalls).toHaveLength(0);
    await openStoryHub(page);
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByRole("button", { name: "Edit One details" }).click();
    await expect(page.getByLabel("Summary", { exact: true })).toHaveValue("My own summary: the keeper sees the ship.");
});

test("merge never offers series entries shared with other stories", async ({ page }) => {
    await createStoryAndChapter(page, "Safety — merge scope", "One");
    await openStoryHub(page);
    await page.getByText("Details, series & voice").click();
    page.once("dialog", dialog => void dialog.accept("Shared Saga"));
    await page.getByLabel("Series").selectOption("__new__");
    await expect(page.getByText("Series bible entries are included")).toBeVisible();

    await openStoryHub(page);
    await page.getByRole("button", { name: "Story Bible" }).click();
    const addEntry = async (name: string, level?: string) => {
        await page.getByRole("button", { name: "New entry" }).click();
        await page.getByLabel("Entry name").fill(name);
        if (level) await page.getByLabel("Level").selectOption(level);
        await page.getByLabel("Description").fill(`${name} description.`);
        await page.getByRole("button", { name: "Save" }).click();
        await expect(page.getByText(`${name} description.`)).toBeVisible();
    };
    await addEntry("Brandon", "series");
    await addEntry("Colonel Brandon");
    await addEntry("The Colonel");

    await page.getByRole("button", { name: "Merge duplicates" }).click();
    const sheet = page.getByRole("dialog", { name: "Merge entries" });
    await expect(sheet.getByText(/1 series\/global entry is shared/)).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Colonel Brandon/ }).first()).toBeVisible();
    // The shared series entry is neither listed nor suggested as a pair
    await expect(sheet.getByRole("button", { name: /^Brandon \(character\)/ })).toHaveCount(0);
    await expect(sheet.getByText(/Colonel Brandon \+ Brandon/)).toHaveCount(0);
});
