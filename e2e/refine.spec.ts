import { expect, type Page, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator, mockGeneration, reworkAll, typeInEditor, waitForSaved } from "./helpers";

/** Refine sends the writer's steer with the same action, and the result before it is kept. */
const answerWithSteer = (page: Page) =>
    mockGeneration(page, ({ editorContext }) =>
        typeof editorContext?.guidance === "string" ? `Steered: ${editorContext.guidance}.` : "Unsteered result."
    );

const refine = async (scope: Page | ReturnType<Page["getByRole"]>, steer: string) => {
    await scope.getByLabel("Refine with a steer").fill(steer);
    await scope.getByRole("button", { name: "Refine", exact: true }).click();
};

test("refine a selection rework: the steer reaches the model, the first attempt stays", async ({ page }) => {
    await answerWithSteer(page);
    await createStoryAndChapter(page, "Refine — rework", "One");
    await typeInEditor(page, "Original sentence.");
    await waitForSaved(page);
    await reworkAll(page);
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Unsteered result.")).toBeVisible();

    await refine(sheet, "darker");
    await expect(sheet.getByText("Steered: darker.")).toBeVisible();
    await expect(sheet.getByText("Attempt 2 of 2")).toBeVisible();
});

test("refine a scene beat take: the steer makes a new take, the first stays", async ({ page }) => {
    await answerWithSteer(page);
    await createStoryAndChapter(page, "Refine — beat", "One");
    await typeInEditor(page, "Setup paragraph.");
    await page.getByRole("button", { name: "Insert scene beat" }).click();
    await page.getByPlaceholder("Describe what happens in this beat…").fill("A storm hits the harbour");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Unsteered result.")).toBeVisible();

    await refine(page, "from her POV");
    await expect(page.getByText("Steered: from her POV.")).toBeVisible();
    await expect(page.getByText("Take 2 of 2")).toBeVisible();
});

test("refine a ghost continuation: the steer reaches the model, the first stays", async ({ page }) => {
    await answerWithSteer(page);
    await createStoryAndChapter(page, "Refine — ghost", "One");
    await typeInEditor(page, "The evening settled in.");
    await page.getByRole("button", { name: "Continue writing" }).click();
    await expect(editorLocator(page).getByText("Unsteered result.")).toBeVisible();

    await refine(page, "slower");
    await expect(editorLocator(page).getByText("Steered: slower.")).toBeVisible();
    await expect(page.getByText("Continuation 2 of 2")).toBeVisible();
});
