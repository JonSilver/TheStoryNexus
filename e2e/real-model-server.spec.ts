import { expect, type Page, test } from "@playwright/test";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createStoryAndChapter, reworkAll, typeInEditor, waitForSaved } from "./helpers";

test.describe.configure({ mode: "serial" });

/**
 * A real OpenAI-compatible model server, so the app's own backend — not a
 * browser-side mock — classifies failures and narrates progress.
 */
test.describe("against a real model server", () => {
    type Mode = "missing-model" | "slow-start" | "stall";
    const server = { mode: "slow-start" as Mode, instance: null as http.Server | null, settingsId: "" };

    const chunk = (content: string) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`;
    const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    test.beforeAll(async ({ request }) => {
        const instance = http.createServer(async (req, res) => {
            if (req.url?.endsWith("/models")) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ object: "list", data: [{ id: "fake-model", object: "model" }] }));
                return;
            }
            if (server.mode === "missing-model") {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: { message: "model 'fake-model' not found" } }));
                return;
            }
            if (server.mode === "slow-start") await pause(3_000);
            res.writeHead(200, { "Content-Type": "text/event-stream" });
            res.write(chunk("The server's own words"));
            if (server.mode === "stall") await pause(12_500);
            res.write(chunk(", finished."));
            res.end("data: [DONE]\n\n");
        });
        server.instance = instance;
        await new Promise<void>(resolve => instance.listen(0, "127.0.0.1", resolve));
        const { port } = instance.address() as AddressInfo;
        const local = await request.put("/api/ai/local-url", { data: { url: `http://127.0.0.1:${port}/v1` } });
        expect(local.ok()).toBe(true);
        const settings = await (await request.get("/api/ai/settings")).json();
        server.settingsId = settings.id;
        const chosen = await request.put(`/api/ai/settings/${settings.id}`, {
            data: { defaultProvider: "local", defaultModelId: "local/fake-model" }
        });
        expect(chosen.ok()).toBe(true);
    });

    test.afterAll(async ({ request }) => {
        await request.put(`/api/ai/settings/${server.settingsId}`, {
            data: { defaultProvider: null, defaultModelId: null }
        });
        await new Promise(resolve => server.instance?.close(resolve));
    });

    const reworkWithRealServer = async (page: Page, title: string) => {
        await createStoryAndChapter(page, title, "One");
        await typeInEditor(page, "Original sentence.");
        await waitForSaved(page);
        await reworkAll(page);
        return page.getByRole("dialog");
    };

    test("a slow start shows the waiting state, then the text", async ({ page }) => {
        server.mode = "slow-start";
        const sheet = await reworkWithRealServer(page, "Real — slow start");
        await expect(sheet.getByText(/Waiting for the model server to respond/)).toBeVisible();
        await expect(sheet.getByText("The server's own words, finished.")).toBeVisible();
    });

    test("a missing model is named, with what to fix", async ({ page }) => {
        server.mode = "missing-model";
        const sheet = await reworkWithRealServer(page, "Real — missing model");
        await expect(sheet.getByText(/fake-model/)).toBeVisible();
        await expect(sheet.getByText(/doesn't have this model/)).toBeVisible();
    });

    test("a pause mid-stream is shown while it lasts", async ({ page }) => {
        test.setTimeout(60_000);
        server.mode = "stall";
        const sheet = await reworkWithRealServer(page, "Real — stall");
        await expect(sheet.getByText(/No new text for/)).toBeVisible({ timeout: 15_000 });
        await expect(sheet.getByText("The server's own words, finished.")).toBeVisible({ timeout: 15_000 });
    });
});
