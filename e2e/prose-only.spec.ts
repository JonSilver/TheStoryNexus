import { expect, test } from "@playwright/test";
import { createStoryAndChapter } from "./helpers";

/**
 * A reply offered as manuscript prose must come back as prose alone — the
 * model is told so last, after the story voice, whether the action uses the
 * built-in prompt or the writer's own. "What gets sent" shows it.
 */

const RULE = "Reply with the passage itself and nothing else";

test("rework always asks for the passage alone — built-in or customised, after the story voice", async ({ page }) => {
    await createStoryAndChapter(page, "Prose only — rework", "One");
    const storyId = new URL(page.url()).pathname.split("/")[2];
    // A fresh database has no AI settings row until something asks for one
    await page.request.get("/api/ai/settings");
    await page.request.put(`/api/stories/${storyId}`, { data: { aiInstructions: "Wry, unhurried narration." } });
    const sent = async () => {
        const response = await page.request.post("/api/generate/preview", {
            data: {
                actionId: "rework",
                storyId,
                editorContext: { selection: "She left." },
                modelRef: { provider: "local", modelId: "local/any" }
            }
        });
        expect(response.ok()).toBe(true);
        const { messages } = (await response.json()) as { messages: Array<{ role: string; content: string }> };
        return messages.find(m => m.role === "system")?.content ?? "";
    };

    const builtIn = await sent();
    expect(builtIn.indexOf("Wry, unhurried narration.")).toBeLessThan(builtIn.indexOf(RULE));
    expect(builtIn.trimEnd().endsWith("quotation marks.")).toBe(true);

    // The writer's own template, with no such instruction, still gets it
    const saved = await page.request.put("/api/actions/overrides", {
        data: { actionId: "rework", storyId, template: [{ role: "user", content: "Make it sing: {{selection}}" }] }
    });
    expect(saved.ok()).toBe(true);
    expect(await sent()).toContain(RULE);
    await page.request.delete(`/api/actions/overrides/rework?storyId=${encodeURIComponent(storyId)}`);
});
