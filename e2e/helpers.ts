import { expect, type Page, type Route } from "@playwright/test";

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
    // Fresh context has no current story: the Story tab offers the library
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Open the library" }).click();
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

/** The background-summary hourly allowance is server-process state shared by every test in a run. */
export const resetBackgroundBudget = async (page: Page) => {
    const response = await page.request.delete("/api/chapters/background-summary-budget");
    expect(response.status()).toBe(204);
};

/** Select the whole chapter and open Rework on it. */
export const reworkAll = async (page: Page) => {
    await editorLocator(page).click();
    await page.keyboard.press("Control+A");
    await page.getByRole("button", { name: "Rework selection" }).click();
};

export type ScriptedReply =
    | { text: string }
    | { error: string; partial?: string }
    | { hold: true }
    | { unreachable: true };

const frame = (event: string, data: object) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** Scripted replies in order. `partial` streams text before the error; `hold` never answers. */
export const scriptGeneration = async (page: Page, replies: ScriptedReply[]) => {
    const queue = [...replies];
    const calls: string[] = [];
    await page.route("**/api/generate/action", (route: Route) => {
        calls.push((route.request().postDataJSON() as { actionId: string }).actionId);
        const next = queue.shift() ?? { text: "fallback reply" };
        if ("hold" in next) return;
        if ("unreachable" in next) return route.abort("connectionrefused");
        const body =
            "text" in next
                ? frame("token", { text: next.text }) + frame("finish", {})
                : (next.partial ? frame("token", { text: next.partial }) : "") +
                  frame("error", { message: next.error });
        return route.fulfill({ status: 200, contentType: "text/event-stream", body });
    });
    return calls;
};

/** The server's own wording for a mid-stream stall. */
export const STALL = "the model stopped sending text for 60 seconds partway through. What arrived has been kept.";
