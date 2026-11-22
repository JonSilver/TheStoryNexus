import { expect, type Page, test } from "@playwright/test";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createStoryAndChapter, reworkAll, typeInEditor, waitForSaved } from "./helpers";

/**
 * A real OpenAI-compatible model server, so the app's own backend — not a
 * browser-side mock — classifies failures and narrates progress. Call inside
 * a describe block: it starts the server before the block and points the
 * app's default model at it, then puts both back afterwards.
 */
export const useFakeModelServer = () => {
    type Mode = "missing-model" | "slow-start" | "stall" | "by-model";
    const server = {
        mode: "slow-start" as Mode,
        instance: null as http.Server | null,
        settingsId: "",
        url: "",
        modelListings: 0,
        /** The model the last completion request asked for. */
        lastModel: ""
    };

    const chunk = (content: string) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`;
    const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    test.beforeAll(async ({ request }) => {
        const instance = http.createServer(async (req, res) => {
            if (req.url?.endsWith("/models")) {
                server.modelListings += 1;
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        object: "list",
                        data: ["fake-model", "alpha-model", "zeta-model"].map(id => ({ id, object: "model" }))
                    })
                );
                return;
            }
            if (server.mode === "missing-model") {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: { message: "model 'fake-model' not found" } }));
                return;
            }
            if (server.mode === "by-model") {
                const body = await new Promise<string>(resolve => {
                    const parts: Buffer[] = [];
                    req.on("data", part => parts.push(part));
                    req.on("end", () => resolve(Buffer.concat(parts).toString()));
                });
                server.lastModel = JSON.parse(body).model;
                res.writeHead(200, { "Content-Type": "text/event-stream" });
                // The default model is the one that won't keep to prose
                res.write(
                    chunk(
                        server.lastModel === "fake-model"
                            ? "Original sentence, reworked.\n\nRevisions made: tightened the rhythm."
                            : `A steadier sentence from ${server.lastModel}.`
                    )
                );
                res.end("data: [DONE]\n\n");
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
        server.url = `http://127.0.0.1:${port}/v1`;
        const local = await request.put("/api/ai/local-url", { data: { url: server.url } });
        expect(local.ok()).toBe(true);
        const settings = await (await request.get("/api/ai/settings")).json();
        server.settingsId = settings.id;
        const chosen = await request.put(`/api/ai/settings/${settings.id}`, {
            data: { defaultProvider: "local", defaultModelId: "local/fake-model" }
        });
        expect(chosen.ok()).toBe(true);
    });

    // Runs even when setup or a test failed: later spec files must not inherit a dead model server
    test.afterAll(async ({ request }) => {
        try {
            const settings = server.settingsId || (await (await request.get("/api/ai/settings")).json()).id;
            await request.put(`/api/ai/settings/${settings}`, {
                data: { defaultProvider: null, defaultModelId: null, favouriteModels: [] }
            });
        } finally {
            server.instance?.closeAllConnections();
            await new Promise(resolve => (server.instance ? server.instance.close(resolve) : resolve(undefined)));
        }
    });

    const reworkWithRealServer = async (page: Page, title: string) => {
        await createStoryAndChapter(page, title, "One");
        await typeInEditor(page, "Original sentence.");
        await waitForSaved(page);
        await reworkAll(page);
        return page.getByRole("dialog");
    };

    return { server, reworkWithRealServer };
};
