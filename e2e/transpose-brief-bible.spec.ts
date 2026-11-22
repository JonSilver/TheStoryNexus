import { expect, test } from "@playwright/test";
import { mockGeneration } from "./helpers";
import { BRIEF, seedOriginal } from "./transposeFixtures";

/**
 * Transpose story (#77), the brief and bible layers: a brief pasted or too
 * long, and a bible step that follows the copy's own bible and the model's
 * replies, whatever their shape.
 */

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

test("bible entries: a reply out of format is read if it can be, kept as written if not, and can always be tried again", async ({
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

    // What the model sent is kept as a draft, as written, with ways on: edit it, try again, or another model
    await expect(
        hall.getByText(/wasn't in a form that could be read as an entry, so it's kept below as written/)
    ).toBeVisible();
    await expect(hall.getByLabel("Transposed name")).toHaveValue("Whitwell Hall");
    await expect(hall.getByLabel("Transposed description")).toHaveValue(/rusting corner shop on the Falls Road/);
    await expect(hall.getByRole("button", { name: "Use a different model for Transpose: Bible Entry" })).toBeVisible();
    // Kept, not just shown: it's still there after a reload
    await page.reload();
    await expect(hall.getByLabel("Transposed description")).toHaveValue(/rusting corner shop on the Falls Road/);
    await hall.getByRole("button", { name: "Try again" }).click();
    await expect(hall.getByLabel("Transposed name")).toHaveValue("Brennan's Corner Shop");
    await expect(hall.getByRole("button", { name: "Previous draft" })).toBeVisible();
});
