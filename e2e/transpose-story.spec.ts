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
