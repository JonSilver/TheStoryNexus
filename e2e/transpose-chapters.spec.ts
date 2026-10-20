import { expect, type Page, test } from "@playwright/test";
import { createStoryAndChapter } from "./helpers";

/**
 * Transpose story (#77), the chapters: each is drafted in the new setting —
 * its outline, then its prose part by part against it — reviewed beside the
 * original, and accepted. Scene breaks stay where they were; the original's
 * chapters never change; opening the screen costs nothing.
 */

const text = (t: string) => ({ type: "text", text: t, format: 0, detail: 0, mode: "normal", style: "", version: 1 });
const para = (t: string) => ({ type: "paragraph", children: [text(t)], version: 1 });
const doc = (...children: unknown[]) => JSON.stringify({ root: { type: "root", children } });
const ONE = doc(
    para("Aunt Hester ruled Whitwell Hall."),
    { type: "horizontalrule", version: 1 },
    para("The rain came.")
);
const TWO = doc(para("Aunt Hester wrote to London."));

const moved = (passage: string) => passage.replace("Aunt Hester", "Mrs Brennan").replace("Whitwell Hall", "the shop");

type Generated = { actionId: string; chapterId?: string; editorContext?: Record<string, string> };

const seedAtChapters = async (page: Page) => {
    await createStoryAndChapter(page, "Transpose chapters — original", "One");
    const storyId = new URL(page.url()).pathname.split("/")[2];
    const [first] = (await (await page.request.get(`/api/chapters/story/${storyId}`)).json()) as Array<{
        id: string;
        saveVersion: number;
    }>;
    await page.request.put(`/api/chapters/${first.id}`, {
        data: { content: ONE, wordCount: 8, expectedSaveVersion: first.saveVersion }
    });
    await page.request.post("/api/chapters", {
        data: { storyId, title: "Two", order: 1, content: TWO, wordCount: 5 }
    });
    const started = await page.request.post("/api/transpositions", {
        data: { sourceStoryId: storyId, target: "1990s Belfast" }
    });
    const { storyId: copyId } = (await started.json()) as { storyId: string };
    const op = (data: object) => page.request.post(`/api/transpositions/${copyId}/ops`, { data });
    await op({ op: "acceptBrief", brief: "Belfast, 1994." });
    await op({ op: "acceptSynopsis", synopsis: null });
    await op({ op: "finishBible" });
    return { storyId, copyId };
};

test("chapters: drafted outline then prose, reviewed beside the original, accepted; scene breaks kept", async ({
    page
}) => {
    const calls: Generated[] = [];
    await page.route("**/api/generate/action", async route => {
        const request = route.request().postDataJSON() as Generated;
        calls.push(request);
        const reply =
            request.actionId === "transpose_outline"
                ? `Outline: chapter ${calls.filter(c => c.actionId === "transpose_outline").length} in Belfast.`
                : moved(request.editorContext?.selection ?? "");
        await route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: `event: token\ndata: ${JSON.stringify({ text: reply })}\n\nevent: finish\ndata: {}\n\n`
        });
    });
    const { storyId, copyId } = await seedAtChapters(page);

    await page.goto(`/story/${copyId}/transpose`);
    await expect(page.locator("[aria-current=step]")).toHaveText("Chapters");
    const one = page.getByRole("listitem", { name: "One" });
    await expect(one.getByText("Not drafted yet").first()).toBeVisible();
    // Opening, reading and waiting cost nothing
    await page.waitForTimeout(500);
    expect(calls).toHaveLength(0);

    await page.getByRole("button", { name: "Draft all the chapters" }).click();
    const two = page.getByRole("listitem", { name: "Two" });
    await expect(two.getByText("Drafted — to review")).toBeVisible();
    // Outline first, then each part with the outline and the previous part's rewrite for continuity
    expect(calls.map(c => c.actionId)).toEqual([
        "transpose_outline",
        "transpose_prose",
        "transpose_prose",
        "transpose_outline",
        "transpose_prose"
    ]);
    expect(calls[1].editorContext).toMatchObject({
        selection: "Aunt Hester ruled Whitwell Hall.",
        userMessage: "Outline: chapter 1 in Belfast."
    });
    expect(calls[2].editorContext?.recentProse).toBe("Mrs Brennan ruled the shop.");

    // Chapter one: each part beside the original, the scene break kept between them
    await expect(one.getByLabel("Outline of One", { exact: true })).toHaveValue("Outline: chapter 1 in Belfast.");
    await expect(one.getByText("Aunt Hester ruled Whitwell Hall.")).toBeVisible();
    await expect(one.getByLabel("Part 1 of One", { exact: true })).toHaveValue("Mrs Brennan ruled the shop.");
    await expect(one.getByText("— scene break —")).toBeVisible();
    await one.getByLabel("Part 2 of One", { exact: true }).fill("The rain came, as it does on the Falls Road.");
    await one.getByRole("button", { name: "Accept this chapter" }).click();
    // Accepted, and on to the next chapter to review
    await expect(one.getByText("Accepted", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Outline of Two", { exact: true })).toBeVisible();

    // Chapter two, edited after drafting: its drafts no longer fit, and it says so
    const [, copyTwo] = (await (await page.request.get(`/api/chapters/story/${copyId}`)).json()) as Array<{
        id: string;
        saveVersion: number;
    }>;
    await page.request.put(`/api/chapters/${copyTwo.id}`, {
        data: {
            content: doc(para("Aunt Hester wrote to London, twice.")),
            wordCount: 6,
            expectedSaveVersion: copyTwo.saveVersion
        }
    });
    await page.reload();
    await expect(two.getByText(/changed since its prose was drafted/)).toBeVisible();
    await expect(two.getByRole("button", { name: "Accept this chapter" })).toBeDisabled();
    await two.getByRole("button", { name: "Draft it again" }).click();
    await expect(two.getByLabel("Part 1 of Two", { exact: true })).toHaveValue("Mrs Brennan wrote to London, twice.");
    await two.getByRole("button", { name: "Accept this chapter" }).click();
    await expect(two.getByText("Accepted", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Finish the transposition" }).click();
    await expect(page.getByText(/Every chapter is transposed/)).toBeVisible();

    // The copy reads in the new setting, scene break where it was, outline as its summary
    const copyChapters = (await (await page.request.get(`/api/chapters/story/${copyId}`)).json()) as Array<{
        content: string;
        summary: string;
        order: number;
    }>;
    const copyOne = copyChapters.find(c => c.order === 0);
    const nodes = JSON.parse(copyOne?.content ?? "{}").root.children.map((n: { type: string }) => n.type);
    expect(nodes).toEqual(["paragraph", "horizontalrule", "paragraph"]);
    expect(copyOne?.content).toContain("Mrs Brennan ruled the shop.");
    expect(copyOne?.content).toContain("Falls Road");
    expect(copyOne?.summary).toBe("Outline: chapter 1 in Belfast.");

    // The original's chapters are as they were
    const originalChapters = (await (await page.request.get(`/api/chapters/story/${storyId}`)).json()) as Array<{
        content: string;
        order: number;
    }>;
    expect(originalChapters.find(c => c.order === 0)?.content).toContain("Aunt Hester ruled Whitwell Hall.");
    expect(originalChapters.find(c => c.order === 1)?.content).toBe(TWO);
});

test("chapters: Stop keeps what was drafted, and drafting again carries on from there", async ({ page }) => {
    const calls: Generated[] = [];
    const hold = { next: false };
    await page.route("**/api/generate/action", async route => {
        const request = route.request().postDataJSON() as Generated;
        calls.push(request);
        // The third request (part 2 of chapter one) never answers: the writer stops it
        if (calls.length === 3 && !hold.next) return;
        const reply =
            request.actionId === "transpose_outline" ? "Outline." : moved(request.editorContext?.selection ?? "");
        await route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: `event: token\ndata: ${JSON.stringify({ text: reply })}\n\nevent: finish\ndata: {}\n\n`
        });
    });
    const { copyId } = await seedAtChapters(page);

    await page.goto(`/story/${copyId}/transpose`);
    await page.getByRole("button", { name: "Draft all the chapters" }).click();
    await expect(page.getByRole("status")).toHaveText(/Chapter 1 of 2: “One” — part 2 of 2/);
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByRole("button", { name: "Draft all the chapters" })).toBeVisible();
    const one = page.getByRole("listitem", { name: "One" });
    await expect(one.getByLabel("Part 1 of One", { exact: true })).toHaveValue("Mrs Brennan ruled the shop.");

    // Carrying on drafts only what's missing: part 2 of One, then Two
    hold.next = true;
    const before = calls.length;
    await page.reload();
    await page.getByRole("button", { name: "Draft all the chapters" }).click();
    await expect(page.getByRole("listitem", { name: "Two" }).getByText("Drafted — to review")).toBeVisible();
    expect(calls.slice(before).map(c => c.actionId)).toEqual([
        "transpose_prose",
        "transpose_outline",
        "transpose_prose"
    ]);
});
