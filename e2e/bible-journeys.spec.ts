import { expect, test } from "@playwright/test";
import { createStoryAndChapter, mockGeneration, typeInEditor, waitForSaved } from "./helpers";

/**
 * Story bible journeys: entries added, extracted, merged and shared through a
 * series, each asserting the writer-visible outcome. AI is mocked at the
 * network layer; everything else is the real stack on a fresh database.
 */

test.describe.configure({ mode: "serial" });

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
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByPlaceholder("New chapter title (optional)").fill("Two");
    await page.getByRole("button", { name: "Add" }).click();
    await typeInEditor(page, "Willoughby arrived without warning.");
    await waitForSaved(page);

    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();
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
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByText("Details, series & voice").click();

    await page.getByLabel("Series").selectOption("__new__");
    await page.getByLabel("Series name").fill("The Dashwood Saga");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("joined the new series")).toBeVisible();
    await expect(page.getByText("Series bible entries are included")).toBeVisible();

    // A series-level entry created from the first story…
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();
    await page.getByRole("button", { name: "New entry" }).click();
    await page.getByLabel("Entry name").fill("Norland Park");
    await page.getByLabel("Category").selectOption("location");
    await page.getByLabel("Level").selectOption("series");
    await page.getByLabel("Description").fill("The Dashwood family seat in Sussex.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("The Dashwood family seat in Sussex.")).toBeVisible();

    // The library groups under the series heading
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Switch story" }).click();
    await expect(page.getByRole("heading", { name: "The Dashwood Saga" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Journey — series" })).toBeVisible();

    // …is inherited by a second story that joins the same series
    await page.getByPlaceholder("New story title").fill("Journey — series sequel");
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByText("Details, series & voice").click();
    await page.getByLabel("Series").selectOption({ label: "The Dashwood Saga" });
    await expect(page.getByText("Series bible entries are included")).toBeVisible();
    await page.getByRole("button", { name: "Story Bible" }).click();
    await expect(page.getByText("The Dashwood family seat in Sussex.")).toBeVisible();
    await expect(page.getByText("(series)")).toBeVisible();

    // A series card in Settings → Series opens the library, inside the app
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Series", exact: true }).click();
    await page.getByText("The Dashwood Saga", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The Dashwood Saga" })).toBeVisible();

    // Deleting the series takes its bible entries with it — the member story's bible says so at once
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Series", exact: true }).click();
    await page.getByRole("button", { name: "Delete The Dashwood Saga" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("The Dashwood Saga", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();
    await expect(page.getByRole("heading", { name: "Story Bible" })).toBeVisible();
    await expect(page.getByText("The Dashwood family seat in Sussex.")).toHaveCount(0);
});

test("bible entries: manual create and edit, no AI required", async ({ page }) => {
    await createStoryAndChapter(page, "Journey — manual bible", "One");
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();

    await page.getByRole("button", { name: "New entry" }).click();
    await page.getByLabel("Entry name").fill("Mrs Jennings");
    await page.getByLabel("Description").fill("A good-humoured meddler.");
    await page.getByLabel("Tags").fill("the meddler");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("A good-humoured meddler.")).toBeVisible();
    await expect(page.getByText("aka: the meddler")).toBeVisible();

    await page.getByRole("button", { name: "Edit Mrs Jennings" }).click();
    await page.getByLabel("Description").fill("A good-humoured meddler with a sharp eye.");
    // Closing with unsaved edits asks first; keeping them loses nothing
    await page.keyboard.press("Escape");
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByLabel("Description")).toHaveValue("A good-humoured meddler with a sharp eye.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("A good-humoured meddler with a sharp eye.")).toBeVisible();
});

test("bible merge: two duplicates become one reviewed entry", async ({ page }) => {
    await mockGeneration(page, request =>
        request.actionId === "merge_entries"
            ? JSON.stringify([
                  {
                      name: "Colonel Brandon",
                      category: "character",
                      description: "Steady and quiet; owns Delaford; plays the pianoforte badly.",
                      tags: ["the colonel", "Brandon"]
                  }
              ])
            : "unused"
    );
    await createStoryAndChapter(page, "Journey — merge", "One");
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Story Bible" }).click();

    for (const [name, desc] of [
        ["Colonel Brandon", "Steady and quiet; owns Delaford."],
        ["Brandon", "Plays the pianoforte badly."]
    ]) {
        await page.getByRole("button", { name: "New entry" }).click();
        await page.getByLabel("Entry name").fill(name);
        await page.getByLabel("Description").fill(desc);
        await page.getByRole("button", { name: "Save" }).click();
    }

    await page.getByRole("button", { name: "Merge duplicates" }).click();
    // The pair is proposed automatically — one tap selects both
    await page.getByRole("button", { name: /Colonel Brandon \+ Brandon/ }).click();
    await page.getByRole("button", { name: "Merge with AI" }).click();
    await expect(page.getByLabel("Merged description")).toHaveValue(/pianoforte badly/);
    await page.getByRole("button", { name: "Save merged entry" }).click();

    // Sheet closes; one entry remains, carrying facts from both
    await expect(page.getByRole("textbox", { name: "Merged description" })).toHaveCount(0);
    await expect(page.getByText("plays the pianoforte badly", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Brandon", exact: true })).toHaveCount(0);
});
