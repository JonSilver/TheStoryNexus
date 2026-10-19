import { expect, type Page, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator, typeInEditor, waitForSaved } from "./helpers";

/**
 * When a generation fails or isn't good enough, the writer tries again in
 * place — no discard / reselect / redo loop — and earlier attempts are kept
 * to flip back to.
 */

test.describe.configure({ mode: "serial" });

type Reply = { text: string } | { error: string };

/** Serves scripted replies in order: text streams normally, error ends the stream with an error. */
const scriptGeneration = async (page: Page, replies: Reply[]) => {
    const queue = [...replies];
    await page.route("**/api/generate/action", route => {
        const next = queue.shift() ?? { text: "fallback reply" };
        const body =
            "text" in next
                ? `event: token\ndata: ${JSON.stringify({ text: next.text })}\n\nevent: finish\ndata: {}\n\n`
                : `event: error\ndata: ${JSON.stringify({ message: next.error })}\n\n`;
        void route.fulfill({ status: 200, contentType: "text/event-stream", body });
    });
};

const reworkAll = async (page: Page) => {
    await editorLocator(page).click();
    await page.keyboard.press("Control+A");
    await page.getByRole("button", { name: "Rework selection" }).click();
};

test("rework: try again keeps earlier attempts, and accept uses the one shown", async ({ page }) => {
    await scriptGeneration(page, [{ text: "First attempt prose." }, { text: "Second attempt prose." }]);
    await createStoryAndChapter(page, "Again — rework", "One");
    await typeInEditor(page, "Original sentence.");
    await waitForSaved(page);

    await reworkAll(page);
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("First attempt prose.")).toBeVisible();
    await sheet.getByRole("button", { name: "Try again" }).click();
    await expect(sheet.getByText("Second attempt prose.")).toBeVisible();
    await expect(sheet.getByText("Attempt 2 of 2")).toBeVisible();

    await sheet.getByRole("button", { name: "Previous attempt" }).click();
    await expect(sheet.getByText("First attempt prose.")).toBeVisible();
    await sheet.getByRole("button", { name: "Replace selection" }).click();
    await expect(editorLocator(page)).toContainText("First attempt prose.");
    await expect(editorLocator(page)).not.toContainText("Second attempt prose.");
});

test("rework: a failure offers try again in place", async ({ page }) => {
    await scriptGeneration(page, [{ error: "The model server reported an error 503." }, { text: "Recovered prose." }]);
    await createStoryAndChapter(page, "Again — failure", "One");
    await typeInEditor(page, "Original sentence.");
    await waitForSaved(page);

    await reworkAll(page);
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("error 503")).toBeVisible();
    await sheet.getByRole("button", { name: "Try again" }).click();
    await expect(sheet.getByText("Recovered prose.")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Replace selection" })).toBeVisible();
});

test("continue: a failed ghost stays with try again; again keeps both continuations", async ({ page }) => {
    await scriptGeneration(page, [
        { error: "couldn't reach the model server (ECONNREFUSED)." },
        { text: "The first continuation." },
        { text: "The second continuation." }
    ]);
    await createStoryAndChapter(page, "Again — ghost", "One");
    await typeInEditor(page, "The evening settled in.");
    await page.getByRole("button", { name: "Continue writing" }).click();

    await expect(page.getByRole("alert").getByText(/couldn't reach the model server/)).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("The first continuation.")).toBeVisible();
    await page.getByRole("button", { name: "Again" }).click();
    await expect(page.getByText("The second continuation.")).toBeVisible();
    await expect(page.getByText("2/2")).toBeVisible();
    await page.getByRole("button", { name: "Previous continuation" }).click();
    await expect(page.getByText("The first continuation.")).toBeVisible();
});

test("brainstorm: a failed reply retries in place, and regenerate keeps the earlier reply", async ({ page }) => {
    await scriptGeneration(page, [
        { error: "the provider is rate-limiting or too busy right now." },
        { text: "Reply one." },
        { text: "Reply two." }
    ]);
    await createStoryAndChapter(page, "Again — brainstorm", "One");
    await page.getByRole("button", { name: "Brainstorm" }).click();
    await page.getByRole("button", { name: "New chat" }).click();
    await page.getByPlaceholder("Bounce an idea around…").fill("Help me with the ending");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText(/rate-limiting/)).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Reply one.")).toBeVisible();

    await page.getByRole("button", { name: "Regenerate reply" }).click();
    await expect(page.getByText("Reply two.")).toBeVisible();
    await expect(page.getByText("Version 2 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Previous version" }).click();
    await expect(page.getByText("Reply one.")).toBeVisible();
});
