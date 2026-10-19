import { expect, type Page, test } from "@playwright/test";
import {
    STALL,
    createStoryAndChapter,
    editorLocator,
    reworkAll,
    scriptGeneration as script,
    typeInEditor,
    waitForSaved
} from "./helpers";

/**
 * Nothing the model writes is lost, failures say what happened, Stop is
 * always a choice not a failure, and back never leaves the app — the
 * writer-visible outcomes behind the review findings on #78–#84.
 */

test.describe.configure({ mode: "serial" });

const openNewChat = async (page: Page) => {
    await page.getByRole("button", { name: "Brainstorm" }).click();
    await page.getByRole("button", { name: "New chat" }).click();
};

const storyIdOf = (page: Page) => new URL(page.url()).pathname.split("/")[2];

test("rework: text that arrived before a failure is kept, marked incomplete, and usable", async ({ page }) => {
    await script(page, [{ partial: "Half a better sentence", error: STALL }]);
    await createStoryAndChapter(page, "Fixes — rework partial", "One");
    await typeInEditor(page, "Original sentence.");
    await waitForSaved(page);

    await reworkAll(page);
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(/stopped sending text/)).toBeVisible();
    await expect(sheet.getByText("Half a better sentence")).toBeVisible();
    await expect(sheet.getByText(/Incomplete/)).toBeVisible();
    await sheet.getByRole("button", { name: "Replace selection" }).click();
    await expect(editorLocator(page)).toContainText("Half a better sentence");
});

test("continue: after a reload, a failed Again never costs the continuation already there", async ({ page }) => {
    await script(page, [
        { text: "A continuation worth keeping." },
        { error: "the model server reported an error 503." }
    ]);
    await createStoryAndChapter(page, "Fixes — ghost reload", "One");
    await typeInEditor(page, "The evening settled in.");
    await page.getByRole("button", { name: "Continue writing" }).click();
    await expect(page.getByText("A continuation worth keeping.")).toBeVisible();
    const chapterId = new URL(page.url()).pathname.split("/").pop();
    await expect
        .poll(async () => (await (await page.request.get(`/api/chapters/${chapterId}`)).json()).content)
        .toContain("A continuation worth keeping.");

    await page.reload();
    await expect(page.getByText("A continuation worth keeping.")).toBeVisible();
    await page.getByRole("button", { name: "Again" }).click();
    await expect(page.getByRole("alert").getByText(/error 503/)).toBeVisible();
    await expect(page.getByText("A continuation worth keeping.")).toBeVisible();
});

test("continue: Stop before any text is the writer's choice, not a model failure", async ({ page }) => {
    await script(page, [{ hold: true }]);
    await createStoryAndChapter(page, "Fixes — ghost stop", "One");
    await typeInEditor(page, "The evening settled in.");
    await page.getByRole("button", { name: "Continue writing" }).click();
    await page.getByRole("button", { name: "Stop" }).click();

    await expect(page.getByRole("button", { name: "Keep" })).toHaveCount(0);
    await expect(page.getByText(/returned nothing/)).toHaveCount(0);
});

test("when the app's own server can't be reached, the writer is told so — not 'Failed to fetch'", async ({ page }) => {
    await script(page, [{ unreachable: true }]);
    await createStoryAndChapter(page, "Fixes — unreachable", "One");
    await typeInEditor(page, "Original sentence.");
    await waitForSaved(page);
    await reworkAll(page);
    await expect(page.getByRole("dialog").getByText(/Couldn't reach The Story Nexus server/)).toBeVisible();
});

test("back from a page reached by an old link stays in the app", async ({ page }) => {
    await page.goto("/?tool=providers");
    await expect(page).toHaveURL(/\/settings\/providers$/);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("button", { name: "AI providers & models" })).toBeVisible();
});

test("a link to a deleted brainstorm chat is corrected, and says so", async ({ page }) => {
    await createStoryAndChapter(page, "Fixes — missing chat", "One");
    const storyId = storyIdOf(page);
    await page.goto(`/story/${storyId}/brainstorm/no-such-chat`);
    await expect(page.getByText("That chat no longer exists")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/story/${storyId}/brainstorm$`));
});

test("back to chats doesn't leave the chat waiting behind browser back", async ({ page }) => {
    await createStoryAndChapter(page, "Fixes — back to chats", "One");
    await openNewChat(page);
    await expect(page).toHaveURL(/\/brainstorm\/.+/);
    await page.getByRole("button", { name: "Back to chats" }).click();
    await expect(page).toHaveURL(/\/brainstorm$/);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/brainstorm\/.+/);
});

test("/write with a remembered story opens it at its real address", async ({ page }) => {
    await createStoryAndChapter(page, "Fixes — storyless", "One");
    const storyId = storyIdOf(page);
    await page.goto("/write");
    await expect(page).toHaveURL(new RegExp(`/story/${storyId}/write/.+`));
});

test("scene beat: a take cut short is kept and marked incomplete, even after a reload", async ({ page }) => {
    await script(page, [{ partial: "The storm broke over the", error: STALL }]);
    await createStoryAndChapter(page, "Fixes — beat partial", "One");
    await typeInEditor(page, "Setup paragraph.");
    await page.getByRole("button", { name: "Insert scene beat" }).click();
    await page.getByPlaceholder("Describe what happens in this beat…").fill("A storm hits the harbour");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("The storm broke over the")).toBeVisible();
    await expect(page.getByText(/Incomplete — cut short/)).toBeVisible();

    const chapterId = new URL(page.url()).pathname.split("/").pop();
    await expect
        .poll(async () => (await (await page.request.get(`/api/chapters/${chapterId}`)).json()).content)
        .toContain("incompleteTakes");
    await page.reload();
    await expect(page.getByText(/Incomplete — cut short/)).toBeVisible();
});

test("a chat link under the wrong story opens the chat in its own story", async ({ page }) => {
    await createStoryAndChapter(page, "Fixes — chat home", "One");
    await openNewChat(page);
    await expect(page).toHaveURL(/\/brainstorm\/.+/);
    const chatPath = new URL(page.url()).pathname;
    const chatId = chatPath.split("/").pop();

    await page.goto("/library");
    await page.getByPlaceholder("New story title").fill("Fixes — other story");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/story\/[^/]+\/chapters$/);
    const otherStory = storyIdOf(page);
    await page.goto(`/story/${otherStory}/brainstorm/${chatId}`);
    await expect(page).toHaveURL(new RegExp(`${chatPath}$`));
});

test("scene beat: a stream that never finished (orphaned by a crash) comes back marked incomplete", async ({
    page
}) => {
    await createStoryAndChapter(page, "Fixes — orphaned beat", "One");
    await typeInEditor(page, "Setup paragraph.");
    await page.getByRole("button", { name: "Insert scene beat" }).click();
    await page.getByPlaceholder("Describe what happens in this beat…").fill("A storm hits the harbour");
    await waitForSaved(page);
    const chapterId = new URL(page.url()).pathname.split("/").pop();
    const url = `/api/chapters/${chapterId}`;
    await expect.poll(async () => (await (await page.request.get(url)).json()).content).toContain("storm hits");

    // As a crash mid-generation leaves it: text streamed, status generating, no take yet
    const chapter = await (await page.request.get(url)).json();
    const doc = JSON.parse(chapter.content);
    const beat = doc.root.children.find((node: { type: string }) => node.type === "scene-beat-v2");
    Object.assign(beat, { status: "generating", streaming: "Half a storm that never" });
    const put = await page.request.put(url, {
        data: { content: JSON.stringify(doc), wordCount: 2, expectedSaveVersion: chapter.saveVersion }
    });
    expect(put.ok()).toBe(true);

    await page.reload();
    await expect(page.getByText("Half a storm that never")).toBeVisible();
    await expect(page.getByText(/Incomplete — cut short/)).toBeVisible();
});
