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

const send = async (page: Page, message: string) => {
    await page.getByPlaceholder("Bounce an idea around…").fill(message);
    await page.getByRole("button", { name: "Send" }).click();
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

test("brainstorm: a reply cut short is kept and labelled, and survives a reload", async ({ page }) => {
    await script(page, [{ partial: "A reply that was cut", error: STALL }]);
    await createStoryAndChapter(page, "Fixes — brainstorm partial", "One");
    await openNewChat(page);
    await send(page, "What happens next?");

    await expect(page.getByText("A reply that was cut")).toBeVisible();
    await expect(page.getByText(/Incomplete — cut short/)).toBeVisible();
    await page.reload();
    await expect(page.getByText("A reply that was cut")).toBeVisible();
    await expect(page.getByText(/Incomplete — cut short/)).toBeVisible();
});

test("brainstorm: a reply that couldn't be saved stays on screen until it is", async ({ page }) => {
    await script(page, [{ text: "A reply worth keeping." }]);
    await createStoryAndChapter(page, "Fixes — unsaved reply", "One");
    await openNewChat(page);

    const writes = { count: 0 };
    await page.route("**/api/brainstorm/*", route => {
        if (route.request().method() !== "PUT") return route.fallback();
        writes.count += 1;
        // The writer's message saves; the reply's write fails
        return writes.count === 2
            ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
            : route.fallback();
    });
    await send(page, "Give me an idea");
    await expect(page.getByText("A reply worth keeping.")).toBeVisible();
    await expect(page.getByText(/isn't saved yet/)).toBeVisible();

    // Leaving and reloading before it's saved must not lose it
    await page.reload();
    await expect(page.getByText("A reply worth keeping.")).toBeVisible();
    await expect(page.getByText(/isn't saved yet/)).toBeVisible();

    await page.getByRole("button", { name: "Save again" }).click();
    await expect(page.getByText(/isn't saved yet/)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("A reply worth keeping.")).toBeVisible();
});

test("brainstorm: leaving mid-reply leaves the message answerable, not stranded", async ({ page }) => {
    await script(page, [{ hold: true }, { text: "Answered at last." }]);
    await createStoryAndChapter(page, "Fixes — left mid-reply", "One");
    await openNewChat(page);
    await send(page, "A question left hanging");
    await expect(page.getByRole("status")).toBeVisible();

    await page.getByRole("button", { name: "Write" }).click();
    await page.getByRole("button", { name: "Brainstorm" }).click();
    await page.getByText("A question left hanging").click();
    await expect(page.getByText("This message hasn't been answered.")).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Answered at last.")).toBeVisible();
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

test("brainstorm: a reply being written stays in its own chat", async ({ page }) => {
    await script(page, [{ hold: true }]);
    await createStoryAndChapter(page, "Fixes — chat binding", "One");
    await openNewChat(page);
    await send(page, "Question for chat one");
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();

    await page.getByRole("button", { name: "Back to chats" }).click();
    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page.getByText(/A reply is still being written in another chat/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(0);
    await page.getByPlaceholder("Bounce an idea around…").fill("Something else");
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
});
