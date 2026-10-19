import { expect, type Page, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator, typeInEditor, waitForSaved } from "./helpers";

/**
 * Every generation costs the writer money. Background work runs only when a
 * substantial change makes it due, once per change, under an hourly cap —
 * never for opening a chapter, never for a word typed, never on a retry loop.
 * And a version counter that ignores small edits must not let a small edit
 * on one device be silently overwritten from another.
 */

test.describe.configure({ mode: "serial" });

// ~225 words: clears auto-summarise's 150-word floor and the significance threshold
const PROSE = "The harbour lights burned low along the wall. ".repeat(25);

type Reply = { ok: true; text: string } | { ok: false };

const countSummaries = async (page: Page, reply: () => Reply = () => ({ ok: true, text: "A summary." })) => {
    const calls: number[] = [];
    await page.route("**/api/generate/action", route => {
        const request = route.request().postDataJSON() as { actionId: string };
        if (request.actionId === "summarise_chapter") calls.push(Date.now());
        const result = reply();
        const body = result.ok
            ? `event: token\ndata: ${JSON.stringify({ text: result.text })}\n\nevent: finish\ndata: {"reason":"complete"}\n\n`
            : `event: error\ndata: ${JSON.stringify({ message: "the model returned nothing." })}\n\n`;
        return route.fulfill({ status: 200, contentType: "text/event-stream", body });
    });
    return calls;
};

const writeAndSettle = async (page: Page, text: string) => {
    await editorLocator(page).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.insertText(text);
    await page.clock.runFor(2_000);
    await waitForSaved(page);
};

const leaveAndReturn = async (page: Page) => {
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Write" }).click();
    await expect(editorLocator(page)).toContainText("harbour lights");
};

test("opening or reading a chapter never runs a background summary", async ({ page }) => {
    const calls = await countSummaries(page);
    await page.clock.install();
    await createStoryAndChapter(page, "Cost — reading", "One");
    await writeAndSettle(page, PROSE);

    // Leave before the idle window ends, come back, and only read
    await leaveAndReturn(page);
    await editorLocator(page).click();
    await page.clock.runFor(300_000);

    expect(calls).toHaveLength(0);
});

test("a substantial change is summarised once; a small edit afterwards costs nothing", async ({ page }) => {
    const calls = await countSummaries(page);
    await page.clock.install();
    await createStoryAndChapter(page, "Cost — small edit", "One");
    await writeAndSettle(page, PROSE);
    await page.clock.runFor(100_000);
    await expect.poll(() => calls.length).toBe(1);

    await writeAndSettle(page, " One more line.");
    await page.clock.runFor(300_000);
    expect(calls).toHaveLength(1);
});

test("a failed background summary is not retried until the chapter changes substantially", async ({ page }) => {
    const calls = await countSummaries(page, () => ({ ok: false }));
    await page.clock.install();
    await createStoryAndChapter(page, "Cost — failure", "One");
    await writeAndSettle(page, PROSE);
    await page.clock.runFor(100_000);
    await expect(page.getByText(/won't try again until the chapter changes substantially/)).toBeVisible();
    expect(calls).toHaveLength(1);

    // Idle time, small edits and revisiting buy no retries
    await page.clock.runFor(600_000);
    await writeAndSettle(page, " A small fix.");
    await page.clock.runFor(100_000);
    await leaveAndReturn(page);
    await page.clock.runFor(300_000);
    expect(calls).toHaveLength(1);

    // A substantial change makes a new summary due: one more attempt
    await writeAndSettle(page, PROSE);
    await page.clock.runFor(100_000);
    await expect.poll(() => calls.length).toBe(2);
});

test("background summaries stop at six an hour", async ({ page }) => {
    const calls = await countSummaries(page);
    await page.clock.install();
    await createStoryAndChapter(page, "Cost — cap", "One");
    for (let round = 0; round < 7; round += 1) {
        await writeAndSettle(page, PROSE);
        await page.clock.runFor(100_000);
    }
    await expect.poll(() => calls.length).toBe(6);

    // An hour later there's room again
    await page.clock.runFor(60 * 60_000);
    await writeAndSettle(page, PROSE);
    await page.clock.runFor(100_000);
    await expect.poll(() => calls.length).toBe(7);
});

test("a small edit on another device is never silently overwritten", async ({ page, context }) => {
    await createStoryAndChapter(page, "Cost — two devices", "One");
    await typeInEditor(page, "First words.");
    await waitForSaved(page);

    const other = await context.newPage();
    await other.goto(page.url());
    await expect(editorLocator(other)).toContainText("First words.");
    await typeInEditor(other, " From the other device.");
    await waitForSaved(other);

    await typeInEditor(page, " And from this one.");
    await expect(page.getByText(/This chapter was changed elsewhere/)).toBeVisible();
});
