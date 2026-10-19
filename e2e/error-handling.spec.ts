import { expect, type Page, type Route, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator, waitForSaved } from "./helpers";

/**
 * When the model server is slow or failing, the writer must SEE it: a
 * waiting indicator with elapsed time while nothing has arrived, then a
 * specific error naming the model and server — never a silent spinner, and
 * never a background failure nobody hears about.
 */

test.describe.configure({ mode: "serial" });

const sse = (...frames: Array<[string, object]>) =>
    frames.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");

/** Holds generation requests until released, so the waiting state is observable. */
const holdGeneration = async (page: Page) => {
    const held: Route[] = [];
    await page.route("**/api/generate/action", route => {
        held.push(route);
    });
    return {
        waitForRequest: async () => expect.poll(() => held.length).toBeGreaterThan(0),
        release: (body: string) =>
            held.splice(0).forEach(route => route.fulfill({ status: 200, contentType: "text/event-stream", body }))
    };
};

const selectAllAndRework = async (page: Page) => {
    await editorLocator(page).click();
    await page.keyboard.press("Control+A");
    await page.getByRole("button", { name: "Rework selection" }).click();
};

test("a slow provider shows a waiting indicator, then a specific error", async ({ page }) => {
    await createStoryAndChapter(page, "Errors — slow provider", "One");
    await editorLocator(page).click();
    await page.keyboard.type("A sentence to rework.");
    await waitForSaved(page);

    const generation = await holdGeneration(page);
    await selectAllAndRework(page);
    await generation.waitForRequest();

    // While nothing has arrived, the writer sees that we're waiting — not a bare spinner
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("status")).toContainText("Waiting for the model server to respond");

    generation.release(
        sse(
            ["status", { phase: "waiting", elapsedMs: 180000 }],
            [
                "error",
                {
                    message:
                        "some-model on the local server at 10.0.0.1:11434 didn't start responding within 3 minutes. The server may be overloaded, still loading the model, or stuck."
                }
            ]
        )
    );

    await expect(sheet.getByText(/didn't start responding within 3 minutes/)).toBeVisible();
    await expect(sheet.getByText(/local server at 10\.0\.0\.1:11434/)).toBeVisible();
    await expect(sheet.getByRole("status")).toHaveCount(0);
});

test("a provider error names the model and what to fix", async ({ page }) => {
    await createStoryAndChapter(page, "Errors — missing model", "One");
    await editorLocator(page).click();
    await page.keyboard.type("Another sentence to rework.");
    await waitForSaved(page);

    await page.route("**/api/generate/action", route =>
        route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: sse([
                "error",
                {
                    message:
                        "gone-model on the local server at 10.0.0.1:11434: the server doesn't have this model (model not found). Pick an available model in Settings, or fix the Rework override in Settings → AI actions."
                }
            ])
        })
    );
    await selectAllAndRework(page);
    await expect(page.getByRole("dialog").getByText(/doesn't have this model/)).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/fix the Rework override/)).toBeVisible();
});

test("a failing background summary is reported, not swallowed", async ({ page }) => {
    await page.route("**/api/generate/action", route =>
        route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: sse([
                "error",
                {
                    message:
                        "qwen3:8b on the local server at 10.0.0.1:11434: the server doesn't have this model. Pick an available model in Settings, or fix the Summarise Chapter override in Settings → AI actions."
                }
            ])
        })
    );
    await page.clock.install();
    await createStoryAndChapter(page, "Errors — background", "One");
    await editorLocator(page).click();
    // Auto-summarise only runs on chapters of 150+ words
    await page.keyboard.insertText("The harbour lights burned low along the wall. ".repeat(25));
    await page.clock.runFor(2_000);
    await waitForSaved(page);
    await page.clock.runFor(120_000);

    const warning = page.getByText(/Background chapter summaries aren't working/);
    await expect(warning).toBeVisible();
    await expect(page.getByText(/fix the Summarise Chapter override/)).toBeVisible();
});
