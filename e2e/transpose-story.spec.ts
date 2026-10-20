import { expect, type Page, test } from "@playwright/test";
import { createStoryAndChapter, mockGeneration, typeInEditor, waitForSaved } from "./helpers";

/**
 * Transpose story (#77): a copy, moved to another time or place layer by
 * layer — brief, synopsis, bible — each settled before the next. The
 * original is never touched; the copy leaves its series, taking the series'
 * entries as its own.
 */

const BRIEF = "Setting: Belfast, 1994. Whitwell Hall becomes the corner shop.";
const SYNOPSIS = "A shopkeeper's daughter must choose between the shop and a life in London.";

const seedOriginal = async (page: Page) => {
    await createStoryAndChapter(page, "Transpose — original", "One");
    const storyId = new URL(page.url()).pathname.split("/")[2];
    await typeInEditor(page, "Aunt Hester ruled Whitwell Hall.");
    await waitForSaved(page);
    const series = await (await page.request.post("/api/series", { data: { name: "The Whitwell Books" } })).json();
    await page.request.put(`/api/stories/${storyId}`, {
        data: { seriesId: series.id, synopsis: "A gentleman's daughter must choose between duty and love." }
    });
    const entry = (name: string, level: "story" | "series", scopeId: string, category: string) =>
        page.request.post("/api/lorebook", {
            data: { level, scopeId, name, description: `${name}, as it was.`, category, tags: [] }
        });
    await entry("Aunt Hester", "story", storyId, "character");
    await entry("Whitwell Hall", "series", series.id, "location");
    return { storyId, seriesId: series.id as string };
};

test("transpose a story: a copy, its brief, synopsis and bible moved in turn; the original untouched", async ({
    page
}) => {
    const entryRequests: string[] = [];
    await mockGeneration(page, ({ actionId, editorContext }) => {
        if (actionId === "transpose_brief") return BRIEF;
        if (actionId === "transpose_synopsis") return SYNOPSIS;
        if (actionId === "transpose_entry") {
            const message = String(editorContext?.userMessage ?? "");
            entryRequests.push(message);
            return message.includes("Aunt Hester")
                ? '[{"name": "Mrs Brennan", "description": "Runs the shop and everyone in it.", "tags": ["Ma"]}]'
                : '[{"name": "Brennan\'s Corner Shop", "description": "On the Falls Road.", "tags": []}]';
        }
        return "unexpected";
    });
    const { storyId, seriesId } = await seedOriginal(page);

    await page.goto(`/story/${storyId}`);
    await page.getByRole("button", { name: "Transpose to another time or place…" }).click();
    await page.getByLabel("Where and when should it be set?").fill("1990s Belfast");
    await page.getByRole("button", { name: "Make a copy and start" }).click();

    // On the copy's Transpose screen, step one
    await expect(page.getByRole("heading", { name: "Transpose" })).toBeVisible();
    await expect(page.getByText("Transpose — original (1990s Belfast)")).toBeVisible();
    const copyId = new URL(page.url()).pathname.split("/")[2];
    expect(copyId).not.toBe(storyId);
    await expect(page.locator("[aria-current=step]")).toHaveText("Brief");

    await page.getByRole("button", { name: "Draft the brief" }).click();
    const draft = page.getByLabel("Draft");
    await expect(draft).toHaveValue(BRIEF);
    // Drafts are kept: leaving and coming back finds it
    await page.reload();
    await expect(draft).toHaveValue(BRIEF);
    // The writer's edits are kept like the draft
    await draft.fill(`${BRIEF} Keep it wry.`);
    await expect
        .poll(
            async () => (await (await page.request.get(`/api/transpositions/${copyId}`)).json()).state.briefAttempts[0]
        )
        .toBe(`${BRIEF} Keep it wry.`);
    await page.reload();
    await expect(draft).toHaveValue(`${BRIEF} Keep it wry.`);
    await page.getByRole("button", { name: "Accept the brief" }).click();

    await expect(page.locator("[aria-current=step]")).toHaveText("Synopsis");
    await page.getByRole("button", { name: "Transpose the synopsis" }).click();
    await expect(draft).toHaveValue(SYNOPSIS);
    await page.getByRole("button", { name: "Accept the synopsis" }).click();

    await expect(page.locator("[aria-current=step]")).toHaveText("Bible");
    // The series entry came along as the copy's own
    const hester = page.getByRole("listitem", { name: "Aunt Hester" });
    const hall = page.getByRole("listitem", { name: "Whitwell Hall" });
    await expect(hall).toBeVisible();
    await page.getByRole("button", { name: "Transpose all entries" }).click();
    await expect(hester.getByLabel("Transposed name")).toHaveValue("Mrs Brennan");
    await expect(hall.getByLabel("Transposed name")).toHaveValue("Brennan's Corner Shop");
    // Every later step is sent the accepted brief, edits and all
    expect(entryRequests).toHaveLength(2);
    const preview = await page.request.post("/api/generate/preview", {
        data: {
            actionId: "transpose_entry",
            storyId: copyId,
            editorContext: { userMessage: "Name: Aunt Hester" },
            modelRef: { provider: "local", modelId: "local/any" }
        }
    });
    const { messages } = (await preview.json()) as { messages: Array<{ content: string }> };
    expect(messages.map(m => m.content).join("\n")).toContain("Keep it wry.");

    await expect(page.getByRole("button", { name: "Go on to the chapters" })).toBeDisabled();
    await hester.getByRole("button", { name: "Accept" }).click();
    await expect(hester.getByText("Accepted")).toBeVisible();
    await hall.getByRole("button", { name: "Keep as it was" }).click();
    await expect(hall.getByText("Kept as it was")).toBeVisible();
    await page.getByRole("button", { name: "Go on to the chapters" }).click();
    await expect(page.locator("[aria-current=step]")).toHaveText("Chapters");

    // The copy: new synopsis, its own bible, out of the series
    const copy = await (await page.request.get(`/api/stories/${copyId}`)).json();
    expect(copy).toMatchObject({ synopsis: SYNOPSIS, seriesId: null });
    const copyBible = (await (await page.request.get(`/api/lorebook/story/${copyId}/hierarchical`)).json()) as Array<{
        name: string;
        level: string;
    }>;
    expect(
        copyBible
            .filter(e => e.level === "story")
            .map(e => e.name)
            .sort()
    ).toEqual(["Mrs Brennan", "Whitwell Hall"]);

    // The original: as it was, still in its series, its series entry unchanged
    const original = await (await page.request.get(`/api/stories/${storyId}`)).json();
    expect(original).toMatchObject({
        synopsis: "A gentleman's daughter must choose between duty and love.",
        seriesId
    });
    const originalBible = (await (
        await page.request.get(`/api/lorebook/story/${storyId}/hierarchical`)
    ).json()) as Array<{ name: string }>;
    expect(originalBible.map(e => e.name).sort()).toEqual(["Aunt Hester", "Whitwell Hall"]);

    // The hub of the copy leads back to it
    await page.goto(`/story/${copyId}`);
    await page.getByRole("button", { name: /Transposition/ }).click();
    await expect(page.locator("[aria-current=step]")).toHaveText("Chapters");
});

test("a transposition in progress survives a story backup and restore", async ({ page }) => {
    await mockGeneration(page, () => BRIEF);
    const { storyId } = await seedOriginal(page);
    const started = await page.request.post("/api/transpositions", {
        data: { sourceStoryId: storyId, target: "1990s Belfast" }
    });
    const { storyId: copyId } = (await started.json()) as { storyId: string };
    await page.request.post(`/api/transpositions/${copyId}/ops`, { data: { op: "addBriefAttempt", text: BRIEF } });
    await page.request.post(`/api/transpositions/${copyId}/ops`, { data: { op: "acceptBrief", brief: BRIEF } });

    const backup = await (await page.request.get(`/api/stories/${copyId}/export`)).body();
    const restored = await page.request.post("/api/stories/import", {
        multipart: { file: { name: "copy.story.json", mimeType: "application/json", buffer: backup } }
    });
    const { storyId: restoredId } = (await restored.json()) as { storyId: string };

    await page.goto(`/story/${restoredId}/transpose`);
    await expect(page.locator("[aria-current=step]")).toHaveText("Synopsis");
    // Its bible drafts follow the entries to their new ids
    const transposition = await (await page.request.get(`/api/transpositions/${restoredId}`)).json();
    const bible = (await (await page.request.get(`/api/lorebook/story/${restoredId}/hierarchical`)).json()) as Array<{
        id: string;
        name: string;
    }>;
    expect(transposition.brief).toBe(BRIEF);
    expect(transposition.state.entryOrder.sort()).toEqual(bible.map(e => e.id).sort());
});

test("the bible step follows the copy's bible: deleted entries leave, new ones join, edits made there are kept", async ({
    page
}) => {
    await mockGeneration(page, () => BRIEF);
    const { storyId } = await seedOriginal(page);
    const started = await page.request.post("/api/transpositions", {
        data: { sourceStoryId: storyId, target: "1990s Belfast" }
    });
    const { storyId: copyId } = (await started.json()) as { storyId: string };
    const op = (data: object) => page.request.post(`/api/transpositions/${copyId}/ops`, { data });
    await op({ op: "acceptBrief", brief: BRIEF });
    await op({ op: "acceptSynopsis", synopsis: null });

    const bible = async () =>
        (await (await page.request.get(`/api/lorebook/story/${copyId}/hierarchical`)).json()) as Array<{
            id: string;
            name: string;
            description: string;
        }>;
    const [hester, hall] = ["Aunt Hester", "Whitwell Hall"].map(name =>
        bible().then(all => all.find(e => e.name === name))
    );
    // In the copy's Bible screen, the writer deletes one entry, edits another and adds a third
    await page.request.delete(`/api/lorebook/${(await hall)?.id}`);
    await page.request.put(`/api/lorebook/${(await hester)?.id}`, { data: { description: "Edited by hand." } });
    await page.request.post("/api/lorebook", {
        data: {
            level: "story",
            scopeId: copyId,
            name: "Belfast Lough",
            description: "Grey.",
            category: "location",
            tags: []
        }
    });

    await page.goto(`/story/${copyId}/transpose`);
    await expect(page.getByRole("listitem", { name: "Belfast Lough" })).toBeVisible();
    await expect(page.getByRole("listitem", { name: "Whitwell Hall" })).toHaveCount(0);
    const hesterCard = page.getByRole("listitem", { name: "Aunt Hester" });
    await expect(hesterCard.getByText("Edited by hand.")).toBeVisible();

    // Keeping an entry leaves it exactly as it is, hand edits and all
    await hesterCard.getByRole("button", { name: "Keep as it was" }).click();
    await page.getByRole("listitem", { name: "Belfast Lough" }).getByRole("button", { name: "Keep as it was" }).click();
    await page.getByRole("button", { name: "Go on to the chapters" }).click();
    await expect(page.locator("[aria-current=step]")).toHaveText("Chapters");
    expect((await bible()).find(e => e.name === "Aunt Hester")?.description).toBe("Edited by hand.");
});

test("a brief too long to leave room for the bible fails loudly, not with an empty bible", async ({ page }) => {
    const { storyId } = await seedOriginal(page);
    const started = await page.request.post("/api/transpositions", {
        data: { sourceStoryId: storyId, target: "1990s Belfast" }
    });
    const { storyId: copyId } = (await started.json()) as { storyId: string };
    await page.request.post(`/api/transpositions/${copyId}/ops`, {
        data: { op: "acceptBrief", brief: "The shop on the corner sells everything. ".repeat(2000) }
    });
    // A fresh database has no AI settings row until something asks for one
    await page.request.get("/api/ai/settings");
    const preview = await page.request.post("/api/generate/preview", {
        data: {
            actionId: "transpose_synopsis",
            storyId: copyId,
            modelRef: { provider: "local", modelId: "local/any" }
        }
    });
    expect(preview.status()).toBe(422);
    expect((await preview.json()).error).toMatch(/brief is too long/);
});

test("a brief the writer already has is pasted in whole and becomes the brief — paragraphs intact, no model call", async ({
    page
}) => {
    const calls: string[] = [];
    await mockGeneration(page, ({ actionId }) => {
        calls.push(actionId);
        return "unexpected";
    });
    const { storyId } = await seedOriginal(page);
    // A long, multi-paragraph brief, as written in Brainstorm
    const section = (n: number) =>
        `${n}. THE WORLD\n\nWealth is measured in Life Support Charters, indivisible shares that guarantee oxygen quotas and clean water. `.repeat(
            12
        );
    const brief = `PITCH BRIEF: THE ENTROPY OF GRACE\nGenre: Hard Science Fiction\n\n${[1, 2, 3, 4, 5, 6].map(section).join("\n\n")}`;
    expect(brief.length).toBeGreaterThan(9_000);

    await page.goto(`/story/${storyId}`);
    await page.getByRole("button", { name: "Transpose to another time or place…" }).click();
    await page.getByLabel("Where and when should it be set?").click();
    await page.keyboard.insertText(brief);
    await page.getByRole("button", { name: "Make a copy and start" }).click();

    await expect(page.getByText("Transpose — original (PITCH BRIEF: THE ENTROPY OF GRACE)")).toBeVisible();
    await expect(page.getByText(/Moving this copy to the setting in your brief/)).toBeVisible();
    await expect(page.getByLabel("Draft", { exact: true })).toHaveValue(brief.trim());
    expect(calls).toHaveLength(0);
    // The AI can still draft one, and says so rather than "Try again"
    await expect(page.getByRole("button", { name: "Draft one with the AI" })).toBeVisible();
    await page.getByRole("button", { name: "Accept the brief" }).click();

    // The accepted brief stays the writer's to revise
    await page.getByText("The brief", { exact: true }).click();
    const accepted = page.getByLabel("The accepted brief");
    await expect(accepted).toHaveValue(brief.trim());
    await accepted.fill("PITCH BRIEF: THE ENTROPY OF GRACE\n\nShorter now.");
    await page.getByRole("button", { name: "Save the brief" }).click();
    await expect
        .poll(async () => {
            const copyId = new URL(page.url()).pathname.split("/")[2];
            return (await (await page.request.get(`/api/transpositions/${copyId}`)).json()).brief;
        })
        .toBe("PITCH BRIEF: THE ENTROPY OF GRACE\n\nShorter now.");

    // The writer can bring their own synopsis too
    await expect(page.locator("[aria-current=step]")).toHaveText("Synopsis");
    await page.getByRole("button", { name: "Write or paste your own synopsis" }).click();
    await page.getByLabel("Write or paste your own synopsis").fill("Elinor keeps the family breathing.");
    await page.getByRole("button", { name: "Keep as a draft" }).click();
    await expect(page.getByLabel("Draft", { exact: true })).toHaveValue("Elinor keeps the family breathing.");
    await page.getByRole("button", { name: "Accept the synopsis" }).click();
    await expect(page.locator("[aria-current=step]")).toHaveText("Bible");
    expect(calls).toHaveLength(0);
});

test("a transposition refused at the start says what's actually wrong", async ({ page }) => {
    const { storyId } = await seedOriginal(page);
    const empty = await page.request.post("/api/transpositions", { data: { sourceStoryId: storyId, target: "  " } });
    expect((await empty.json()).error).toMatch(/Say where and when the story should be set, or paste a brief/);
    const huge = await page.request.post("/api/transpositions", {
        data: { sourceStoryId: storyId, target: "x".repeat(100_001) }
    });
    expect((await huge.json()).error).toMatch(/100,001 characters — the most a brief can be is 100,000/);
});

test("a story with no synopsis can be given one; an edit pressed straight into Accept raises no false error", async ({
    page
}) => {
    await mockGeneration(page, () => "unexpected");
    const { storyId } = await seedOriginal(page);
    await page.request.put(`/api/stories/${storyId}`, { data: { synopsis: "" } });
    const started = await page.request.post("/api/transpositions", {
        data: { sourceStoryId: storyId, target: "1990s Belfast" }
    });
    const { storyId: copyId } = (await started.json()) as { storyId: string };
    await page.request.post(`/api/transpositions/${copyId}/ops`, { data: { op: "addBriefAttempt", text: "A brief." } });

    await page.goto(`/story/${copyId}/transpose`);
    const draft = page.getByLabel("Draft", { exact: true });
    await expect(draft).toHaveValue("A brief.");
    // Edit and accept at once: the accept carries the edit; nothing reports a failed save afterwards
    await draft.fill("A brief, edited.");
    await page.getByRole("button", { name: "Accept the brief" }).click();
    await expect(page.locator("[aria-current=step]")).toHaveText("Synopsis");
    await page.waitForTimeout(1500);
    await expect(page.getByText(/That step is finished/)).toHaveCount(0);
    expect((await (await page.request.get(`/api/transpositions/${copyId}`)).json()).brief).toBe("A brief, edited.");

    await expect(page.getByText(/This story has no synopsis/)).toBeVisible();
    await page.getByRole("button", { name: "Write or paste your own synopsis" }).click();
    await page.getByLabel("Write or paste your own synopsis").fill("Elinor keeps the family breathing.");
    await page.getByRole("button", { name: "Keep as a draft" }).click();
    await page.getByRole("button", { name: "Accept the synopsis" }).click();
    await expect(page.locator("[aria-current=step]")).toHaveText("Bible");
    expect((await (await page.request.get(`/api/stories/${copyId}`)).json()).synopsis).toBe(
        "Elinor keeps the family breathing."
    );
});

test("bible entries: a reply out of format is read if it can be, shown and usable if not, and can always be tried again", async ({
    page
}) => {
    const replies = [
        // A lone object, wrapped in chat: read as the entry
        'Sure! Here you go:\n```json\n{"name": "Mrs Brennan", "description": "Runs the shop.", "tags": ["Ma"]}\n```',
        // Prose: can't be read as an entry
        "Whitwell Hall would become a rusting corner shop on the Falls Road, its upstairs rooms let to lodgers.",
        // Tried again: this time it's fine
        '[{"name": "Brennan\'s Corner Shop", "description": "On the Falls Road.", "tags": []}]'
    ];
    await mockGeneration(page, ({ actionId }) => (actionId === "transpose_entry" ? (replies.shift() ?? "") : ""));
    const { storyId } = await seedOriginal(page);
    const started = await page.request.post("/api/transpositions", {
        data: { sourceStoryId: storyId, target: "1990s Belfast" }
    });
    const { storyId: copyId } = (await started.json()) as { storyId: string };
    await page.request.post(`/api/transpositions/${copyId}/ops`, { data: { op: "acceptBrief", brief: BRIEF } });
    await page.request.post(`/api/transpositions/${copyId}/ops`, { data: { op: "acceptSynopsis", synopsis: null } });

    await page.goto(`/story/${copyId}/transpose`);
    await page.getByRole("button", { name: "Transpose all entries" }).click();
    const hester = page.getByRole("listitem", { name: "Aunt Hester" });
    const hall = page.getByRole("listitem", { name: "Whitwell Hall" });
    await expect(hester.getByLabel("Transposed name")).toHaveValue("Mrs Brennan");

    // What the model sent is shown, with ways on: use it, try again, or another model
    await expect(hall.getByText(/wasn't in a form that could be read as an entry/)).toBeVisible();
    await expect(hall.getByText(/rusting corner shop on the Falls Road/)).toBeVisible();
    await expect(hall.getByRole("button", { name: "Use a different model for Transpose: Bible Entry" })).toBeVisible();
    await hall.getByRole("button", { name: "Use it as a draft" }).click();
    await expect(hall.getByLabel("Transposed name")).toHaveValue("Whitwell Hall");
    await expect(hall.getByLabel("Transposed description")).toHaveValue(/rusting corner shop/);
    await hall.getByRole("button", { name: "Try again" }).click();
    await expect(hall.getByLabel("Transposed name")).toHaveValue("Brennan's Corner Shop");
    await expect(hall.getByRole("button", { name: "Previous draft" })).toBeVisible();
});
