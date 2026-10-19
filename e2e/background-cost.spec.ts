import { type BrowserContext, expect, type Page, type Route, test } from "@playwright/test";
import { createStoryAndChapter, editorLocator, resetBackgroundBudget, typeInEditor, waitForSaved } from "./helpers";

/**
 * Every generation costs the writer money. Background work runs only when a
 * substantial change makes it due, once per change across every device,
 * under an app-wide hourly cap — never for opening a chapter, never for a
 * word typed, never on a retry loop — and never lands over a summary the
 * writer saved meanwhile. A version counter that ignores small edits must
 * not let a small edit on one device be silently overwritten from another.
 */

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => resetBackgroundBudget(page));

// ~225 words: clears auto-summarise's 150-word floor and the significance threshold
const PROSE = "The harbour lights burned low along the wall. ".repeat(25);

type Reply = { ok: true; text: string } | { ok: false } | { hold: true };

const countSummaries = async (
    target: Page | BrowserContext,
    reply: () => Reply = () => ({ ok: true, text: "A summary." })
) => {
    const calls: number[] = [];
    const held: Route[] = [];
    await target.route("**/api/generate/action", route => {
        const request = route.request().postDataJSON() as { actionId: string };
        if (request.actionId === "summarise_chapter") calls.push(calls.length);
        const result = reply();
        if ("hold" in result) {
            held.push(route);
            return;
        }
        const body = result.ok
            ? `event: token\ndata: ${JSON.stringify({ text: result.text })}\n\nevent: finish\ndata: {"reason":"complete"}\n\n`
            : `event: error\ndata: ${JSON.stringify({ message: "the model returned nothing." })}\n\n`;
        return route.fulfill({ status: 200, contentType: "text/event-stream", body });
    });
    const release = (text: string) =>
        held.splice(0).forEach(route =>
            route.fulfill({
                status: 200,
                contentType: "text/event-stream",
                body: `event: token\ndata: ${JSON.stringify({ text })}\n\nevent: finish\ndata: {"reason":"complete"}\n\n`
            })
        );
    return Object.assign(calls, { release, held });
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

const chapterIdOf = (page: Page) => new URL(page.url()).pathname.split("/").pop() as string;

const summaryOf = async (page: Page) =>
    (await (await page.request.get(`/api/chapters/${chapterIdOf(page)}`)).json()) as {
        summary?: string;
        summaryLocked?: boolean;
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
    await expect.poll(async () => (await summaryOf(page)).summary).toBe("A summary.");

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
        await expect.poll(() => calls.length).toBe(Math.min(round + 1, 6));
    }
    await page.clock.runFor(300_000);
    expect(calls).toHaveLength(6);
});

test("two devices never both pay for the same chapter change", async ({ page, context }) => {
    const calls = await countSummaries(context);
    await page.clock.install();
    await createStoryAndChapter(page, "Cost — two devices, one summary", "One");
    const other = await context.newPage();
    await other.clock.install();

    // Each device saves a substantial change of its own, one after the other
    await writeAndSettle(page, PROSE);
    await other.goto(page.url());
    await writeAndSettle(other, PROSE);

    // Both now idle with a summary pending; only one may be paid for the latest revision
    await page.clock.runFor(100_000);
    await other.clock.runFor(100_000);
    await expect.poll(() => calls.length).toBe(1);
    await page.clock.runFor(300_000);
    await other.clock.runFor(300_000);
    expect(calls).toHaveLength(1);
});

test("a summary the writer saves while one is generating is never overwritten", async ({ page }) => {
    const calls = await countSummaries(page, () => ({ hold: true }));
    await page.clock.install();
    await createStoryAndChapter(page, "Cost — writer wins", "One");
    await writeAndSettle(page, PROSE);
    await page.clock.runFor(100_000);
    await expect.poll(() => calls.held.length).toBe(1);

    // While the model is still working, the writer saves their own summary elsewhere
    const put = await page.request.put(`/api/chapters/${chapterIdOf(page)}`, {
        data: { summary: "My own summary.", summaryLocked: true }
    });
    expect(put.ok()).toBe(true);
    calls.release("AN AI SUMMARY THAT MUST NOT LAND");
    await page.clock.runFor(2_000);

    await expect.poll(async () => (await summaryOf(page)).summary).toBe("My own summary.");
    await page.clock.runFor(5_000);
    expect((await summaryOf(page)).summary).toBe("My own summary.");
});

test("a summary that was generated but couldn't be saved is reported", async ({ page }) => {
    await countSummaries(page);
    await page.route("**/api/chapters/*", route => {
        const body = route.request().postData() ?? "";
        return route.request().method() === "PUT" && body.includes("backgroundSummary")
            ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
            : route.fallback();
    });
    await page.clock.install();
    await createStoryAndChapter(page, "Cost — unsaved", "One");
    await writeAndSettle(page, PROSE);
    await page.clock.runFor(100_000);
    await expect(page.getByText(/a summary was generated but couldn't be saved/)).toBeVisible();
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

test("a device that only reads never pays for another device's edit", async ({ page, context }) => {
    await page.clock.install();
    await createStoryAndChapter(page, "Cost — reader pays nothing", "One");
    const readerCalls = await countSummaries(page);

    const writer = await context.newPage();
    await writer.clock.install();
    const writerCalls = await countSummaries(writer);
    await writer.goto(page.url());
    await writeAndSettle(writer, PROSE);
    // The writer's device leaves before its idle window: its own summary never runs
    await writer.close();

    // The reader picks up the new content and just reads
    await page.reload();
    await expect(editorLocator(page)).toContainText("harbour lights");
    await page.clock.runFor(300_000);
    expect(readerCalls).toHaveLength(0);
    expect(writerCalls).toHaveLength(0);
});

test("a tab running an older build stops and offers its draft instead of retrying forever", async ({ page }) => {
    await createStoryAndChapter(page, "Cost — stale tab", "One");
    await page.route("**/api/chapters/*", route => {
        const request = route.request();
        if (request.method() !== "PUT") return route.fallback();
        const { expectedSaveVersion, ...legacy } = request.postDataJSON() as Record<string, unknown>;
        return route.fallback({ postData: JSON.stringify({ ...legacy, expectedRevision: expectedSaveVersion }) });
    });
    await typeInEditor(page, "Words typed in an old tab.");
    await expect(page.getByText(/This chapter was changed elsewhere/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Download my version" })).toBeVisible();
});

test("a summary the chapter has outgrown is labelled out of date", async ({ page }) => {
    await countSummaries(page);
    await page.clock.install();
    await createStoryAndChapter(page, "Cost — outdated label", "One");
    await writeAndSettle(page, PROSE);
    await page.clock.runFor(100_000);
    await expect.poll(async () => (await summaryOf(page)).summary).toBe("A summary.");

    const details = async () => {
        await page.getByRole("button", { name: "Story", exact: true }).click();
        await page.getByRole("button", { name: "Chapters" }).click();
        await page.getByRole("button", { name: "Edit One details" }).click();
    };
    await details();
    await expect(page.getByText(/Out of date/)).toHaveCount(0);
    await page.getByRole("dialog", { name: "Chapter details" }).getByRole("button", { name: "Close" }).click();

    // A substantial change, then leaving before the idle window: the summary is now behind
    await page.getByRole("button", { name: "Write" }).click();
    await writeAndSettle(page, " The keeper climbed the stair again and watched the ships. ".repeat(10));
    await details();
    await expect(page.getByText(/Out of date/)).toBeVisible();
});

test("a background summary the server can't be asked about is reported, not dropped", async ({ page }) => {
    const calls = await countSummaries(page);
    await page.route("**/api/chapters/*/background-summary", route =>
        route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
    );
    await page.clock.install();
    await createStoryAndChapter(page, "Cost — claim fails", "One");
    await writeAndSettle(page, PROSE);
    await page.clock.runFor(100_000);
    await expect(page.getByText(/couldn't reach the app's server/)).toBeVisible();
    expect(calls).toHaveLength(0);
});

test("leaving a chapter mid-save never runs its summary behind the writer's back", async ({ page }) => {
    const calls = await countSummaries(page);
    await page.clock.install();
    await createStoryAndChapter(page, "Cost — left mid-save", "First");
    await page.getByRole("button", { name: "Story", exact: true }).click();
    await page.getByRole("button", { name: "Chapters" }).click();
    await page.getByPlaceholder("New chapter title (optional)").fill("Second");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(editorLocator(page)).toBeVisible();

    await page.getByLabel("Chapter", { exact: true }).selectOption({ label: "First" });
    await editorLocator(page).click();
    await page.keyboard.insertText(PROSE);
    // Switch away before the debounced save: the exit save settles after this editor has gone
    await page.getByLabel("Chapter", { exact: true }).selectOption({ label: "Second" });
    await page.clock.runFor(300_000);
    expect(calls).toHaveLength(0);

    await page.getByLabel("Chapter", { exact: true }).selectOption({ label: "First" });
    await expect(editorLocator(page)).toContainText("harbour lights");
});
