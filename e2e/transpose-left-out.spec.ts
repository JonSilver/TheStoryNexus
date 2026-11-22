import { expect, test } from "@playwright/test";
import { BRIEF, seedOriginal } from "./transposeFixtures";

test("an entry left out of AI context stays out of the transposition's prompts until it is switched back on", async ({
    page
}) => {
    const { storyId } = await seedOriginal(page);
    const started = await page.request.post("/api/transpositions", {
        data: { sourceStoryId: storyId, target: "1990s Belfast" }
    });
    const { storyId: copyId } = (await started.json()) as { storyId: string };
    await page.request.post(`/api/transpositions/${copyId}/ops`, { data: { op: "acceptBrief", brief: BRIEF } });
    // A fresh database has no AI settings row until something asks for one
    await page.request.get("/api/ai/settings");

    const entries = (await (await page.request.get(`/api/lorebook/story/${copyId}/hierarchical`)).json()) as Array<{
        id: string;
        name: string;
    }>;
    const hester = entries.find(e => e.name === "Aunt Hester");
    expect(hester).toBeDefined();
    const sent = async () => {
        const response = await page.request.post("/api/generate/preview", {
            data: {
                actionId: "transpose_synopsis",
                storyId: copyId,
                modelRef: { provider: "local", modelId: "local/any" }
            }
        });
        expect(response.ok()).toBe(true);
        const { messages } = (await response.json()) as { messages: Array<{ content: string }> };
        return messages.map(m => m.content).join("\n");
    };

    expect(await sent()).toContain("Aunt Hester");
    await page.request.put(`/api/lorebook/${hester?.id}`, { data: { isDisabled: true } });
    const leftOut = await sent();
    expect(leftOut).toContain("Whitwell Hall");
    expect(leftOut).not.toContain("Aunt Hester");
    await page.request.put(`/api/lorebook/${hester?.id}`, { data: { isDisabled: false } });
    expect(await sent()).toContain("Aunt Hester");
});
