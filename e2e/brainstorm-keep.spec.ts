import { expect, type Page, test } from "@playwright/test";
import { STALL, createStoryAndChapter, scriptGeneration as script } from "./helpers";

/**
 * Brainstorm never loses a reply: cut short, it's kept and labelled; unsaved,
 * it stays on this device (merged with, never instead of, what other devices
 * saved); a reply being written belongs to its own chat.
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

test("brainstorm: a reply this device couldn't save never overwrites what another device saved", async ({
    page,
    browser
}) => {
    await script(page, [{ text: "Reply from this device." }]);
    await createStoryAndChapter(page, "Fixes — two devices chat", "One");
    await openNewChat(page);
    await expect(page).toHaveURL(/\/brainstorm\/.+/);
    const chatUrl = page.url();
    const writes = { count: 0 };
    await page.route("**/api/brainstorm/*", route => {
        if (route.request().method() !== "PUT") return route.fallback();
        writes.count += 1;
        return writes.count === 2
            ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
            : route.fallback();
    });
    await send(page, "Question here");
    await expect(page.getByText(/isn't saved yet/)).toBeVisible();

    // Another device, its own browser: adds to the same chat successfully
    const other = await (await browser.newContext()).newPage();
    await script(other, [{ text: "Reply from the other device." }]);
    await other.goto(chatUrl);
    await send(other, "Question there");
    await expect(other.getByText("Reply from the other device.")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Reply from the other device.")).toBeVisible();
    await expect(page.getByText("Reply from this device.")).toBeVisible();
    await page.getByRole("button", { name: "Save again" }).click();
    await expect(page.getByText(/isn't saved yet/)).toHaveCount(0);

    await other.reload();
    await expect(other.getByText("Reply from the other device.")).toBeVisible();
    await expect(other.getByText("Reply from this device.")).toBeVisible();
});

test("brainstorm: a message sent after an unsaved reply saves it too, even if its own reply fails", async ({
    page
}) => {
    await script(page, [{ text: "The reply that failed to save." }, { error: STALL }]);
    await createStoryAndChapter(page, "Fixes — send after unsaved", "One");
    await openNewChat(page);
    const writes = { count: 0 };
    await page.route("**/api/brainstorm/*", route => {
        if (route.request().method() !== "PUT") return route.fallback();
        writes.count += 1;
        return writes.count === 2
            ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
            : route.fallback();
    });
    await send(page, "First question");
    await expect(page.getByText(/isn't saved yet/)).toBeVisible();

    // The second message's write carries the unsaved reply with it; its own reply then fails
    await send(page, "Second question");
    await expect(
        page.getByText("This message hasn't been answered.").or(page.getByText(/stopped sending/))
    ).toBeVisible();
    await expect(page.getByText(/isn't saved yet/)).toHaveCount(0);
    await expect(page.getByText("Second question")).toBeVisible();
    await page.reload();
    for (const text of ["First question", "The reply that failed to save.", "Second question"])
        await expect(page.getByText(text)).toBeVisible();
});

test("brainstorm: two devices writing to one chat without seeing each other's turn both keep theirs", async ({
    page,
    browser
}) => {
    await script(page, [{ text: "Reply here." }]);
    await createStoryAndChapter(page, "Keep — concurrent", "One");
    await openNewChat(page);
    await expect(page).toHaveURL(/\/brainstorm\/.+/);
    const other = await (await browser.newContext()).newPage();
    await script(other, [{ text: "Reply there." }]);
    await other.goto(page.url());
    await expect(other.getByPlaceholder("Bounce an idea around…")).toBeVisible();

    // The other device writes first; this one still holds the older conversation
    await send(other, "Question there");
    await expect(other.getByText("Reply there.")).toBeVisible();
    await send(page, "Question here");
    await expect(page.getByText("Reply here.")).toBeVisible();

    await page.reload();
    for (const text of ["Question there", "Reply there.", "Question here", "Reply here."])
        await expect(page.getByText(text)).toBeVisible();
});

test("brainstorm: a write that landed but whose answer was lost is never doubled", async ({ page }) => {
    await script(page, [{ text: "Exactly one of me." }]);
    await createStoryAndChapter(page, "Keep — lost answer", "One");
    await openNewChat(page);
    const writes = { count: 0 };
    await page.route("**/api/brainstorm/*", async route => {
        if (route.request().method() !== "PUT") return route.fallback();
        writes.count += 1;
        if (writes.count !== 2) return route.fallback();
        // The server saves the reply; the answer never arrives
        await route.fetch();
        return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    });
    await send(page, "Say it once");
    await expect(page.getByText(/isn't saved yet/)).toBeVisible();
    await page.getByRole("button", { name: "Save again" }).click();
    await expect(page.getByText(/isn't saved yet/)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Exactly one of me.")).toHaveCount(1);
});

test("brainstorm: reloading while a reply is being saved never loses it", async ({ page }) => {
    await script(page, [{ text: "A reply mid-save." }]);
    await createStoryAndChapter(page, "Keep — reload mid-save", "One");
    await openNewChat(page);
    const writes = { count: 0 };
    await page.route("**/api/brainstorm/*", route => {
        if (route.request().method() !== "PUT") return route.fallback();
        writes.count += 1;
        // The reply's save never completes before the page goes
        return writes.count === 2 ? undefined : route.fallback();
    });
    await send(page, "Quick, before it saves");
    await expect.poll(() => writes.count).toBe(2);

    await page.reload();
    await expect(page.getByText("A reply mid-save.")).toBeVisible();
    await expect(page.getByText(/isn't saved yet/)).toBeVisible();
    await page.getByRole("button", { name: "Save again" }).click();
    await expect(page.getByText(/isn't saved yet/)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("A reply mid-save.")).toBeVisible();
});

test("brainstorm: unsaved changes to a chat deleted elsewhere are dropped, and the writer is told", async ({
    page
}) => {
    await script(page, [{ text: "A reply nobody will keep." }]);
    await createStoryAndChapter(page, "Keep — deleted elsewhere", "One");
    await openNewChat(page);
    await expect(page).toHaveURL(/\/brainstorm\/.+/);
    const chatId = new URL(page.url()).pathname.split("/").pop();
    const writes = { count: 0 };
    await page.route("**/api/brainstorm/*", route => {
        if (route.request().method() !== "PUT") return route.fallback();
        writes.count += 1;
        return writes.count === 2
            ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
            : route.fallback();
    });
    await send(page, "Question");
    await expect(page.getByText(/isn't saved yet/)).toBeVisible();

    // Another device deletes the chat
    expect((await page.request.delete(`/api/brainstorm/${chatId}`)).ok()).toBe(true);
    await page.getByRole("button", { name: "Save again" }).click();
    await expect(page.getByText(/That chat was deleted, so its unsaved changes were dropped/)).toBeVisible();
    await expect(page.getByText(/isn't saved yet/)).toHaveCount(0);
});

test("brainstorm: a message whose save landed but whose answer was lost is never sent twice", async ({ page }) => {
    await script(page, [{ text: "One reply." }]);
    await createStoryAndChapter(page, "Keep — message lost answer", "One");
    await openNewChat(page);
    const writes = { count: 0 };
    await page.route("**/api/brainstorm/*", async route => {
        if (route.request().method() !== "PUT") return route.fallback();
        writes.count += 1;
        if (writes.count !== 1) return route.fallback();
        // The server saves the message; the answer never arrives
        await route.fetch();
        return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    });
    await send(page, "Asked once");
    await expect(page.getByText(/isn't saved yet/)).toBeVisible();
    await expect(page.getByPlaceholder("Bounce an idea around…")).toHaveValue("");

    await page.getByRole("button", { name: "Save again" }).click();
    await expect(page.getByText(/isn't saved yet/)).toHaveCount(0);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("One reply.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Asked once")).toHaveCount(1);
});
