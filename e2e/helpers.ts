import { expect, type Page } from "@playwright/test";

/**
 * Deterministic AI at the network layer: /api/generate/action is answered
 * with an SSE stream built from the responder, keyed by actionId. The real
 * backend serves everything else, so these tests exercise the full stack
 * minus the model server.
 */
export type GenerationResponder = (request: { actionId: string; editorContext?: Record<string, unknown> }) => string;

const sseBody = (text: string): string => {
    const chunks = text.match(/.{1,20}/gs) ?? [];
    const tokenEvents = chunks.map(chunk => `event: token\ndata: ${JSON.stringify({ text: chunk })}\n\n`).join("");
    return `${tokenEvents}event: finish\ndata: {"reason":"complete"}\n\n`;
};

export const mockGeneration = async (page: Page, responder: GenerationResponder) => {
    await page.route("**/api/generate/action", async route => {
        const request = route.request().postDataJSON() as Parameters<GenerationResponder>[0];
        await route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: sseBody(responder(request))
        });
    });
};

export const editorLocator = (page: Page) => page.locator('div[contenteditable="true"]');

export const createStoryAndChapter = async (page: Page, storyTitle: string, chapterTitle: string) => {
    await page.goto("/v2");
    await page.getByRole("button", { name: "Stories" }).click();
    await page.getByPlaceholder("New story title").fill(storyTitle);
    await page.getByRole("button", { name: "Create" }).click();
    // Creating a story lands on Chapters
    await page.getByPlaceholder("New chapter title (optional)").fill(chapterTitle);
    await page.getByRole("button", { name: "Add" }).click();
    // Creating a chapter lands in the editor
    await expect(editorLocator(page)).toBeVisible();
};

export const typeInEditor = async (page: Page, text: string) => {
    const editor = editorLocator(page);
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(text);
};

export const waitForSaved = async (page: Page) => {
    await expect(page.locator("[data-save-status=saved]")).toBeVisible({ timeout: 10_000 });
};
