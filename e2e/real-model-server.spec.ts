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
    const server = {
        mode: "slow-start" as Mode,
        instance: null as http.Server | null,
        settingsId: "",
        url: "",
        modelListings: 0
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

    test("settings: the server URL saves and tests, its model becomes the default, and both stick", async ({
        page
    }) => {
        await page.goto("/settings/providers");
        const field = page.getByLabel("Server URL (OpenAI-compatible)");
        const save = page.getByRole("button", { name: "Save & test" });
        await expect(field).toHaveValue(server.url);
        // An emptied field stays empty — it doesn't spring back to the saved URL
        await field.fill("");
        await expect(field).toHaveValue("");
        await expect(save).toBeDisabled();

        await field.fill(server.url);
        server.modelListings = 0;
        await save.click();
        await expect(page.getByText("Local models loaded")).toBeVisible();
        // One save, one look at the server's models — not a second fetch whose failure would misreport the save
        expect(server.modelListings).toBe(1);
        await page.getByLabel("Default model").click();
        await page.getByRole("option", { name: "fake-model" }).click();
        await expect(page.getByText(/^Default model: .*fake-model/)).toBeVisible();

        await page.reload();
        await expect(page.getByLabel("Default model")).toHaveText(/fake-model/);
        const settings = await (await page.request.get("/api/ai/settings")).json();
        expect(settings.defaultProvider).toBe("local");
        expect(settings.defaultModelId).toMatch(/fake-model/);
    });

    test("model lists search, and a starred model leads every one of them", async ({ page }) => {
        await page.goto("/settings/providers");
        await page.getByLabel("Default model").click();
        const list = page.getByRole("listbox");
        // Type to search: only the match is offered
        await page.getByPlaceholder("Search models…").fill("zeta");
        await expect(list.getByRole("option")).toHaveCount(1);
        await page.getByRole("button", { name: "Favourite zeta-model" }).click();
        await expect(page.getByRole("button", { name: "Unfavourite zeta-model" }).first()).toBeVisible();
        await page.getByPlaceholder("Search models…").fill("");
        // Starring didn't choose it
        await expect(page.getByText(/^Default model: /)).toHaveCount(0);
        await expect(list.getByRole("option").first()).toContainText("zeta-model");
        await page.keyboard.press("Escape");

        // The same favourite leads the per-action model list, and choosing from it sticks
        await page.goto("/settings/actions");
        await page.getByRole("button", { name: /^Rework/ }).click();
        await page.getByLabel("Model for this action").click();
        await expect(page.getByRole("group", { name: "Favourites" }).getByRole("option")).toHaveText([/zeta-model/]);
        await page
            .getByRole("group", { name: "Favourites" })
            .getByRole("option", { name: /zeta-model/ })
            .click();
        await expect(page.getByLabel("Model for this action")).toHaveText(/zeta-model/);
        await page.getByRole("button", { name: "Save override" }).click();
        await expect(page.getByText("Override saved")).toBeVisible();

        await page.reload();
        await page.getByRole("button", { name: /^Rework/ }).click();
        await expect(page.getByLabel("Model for this action")).toHaveText(/zeta-model/);
        await page.getByRole("button", { name: "Reset to built-in" }).click();
        const settings = await (await page.request.get("/api/ai/settings")).json();
        expect(settings.favouriteModels).toEqual([{ provider: "local", modelId: "local/zeta-model" }]);
    });

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

    test("leaving Brainstorm mid-reply keeps what arrived, marked incomplete", async ({ page }) => {
        test.setTimeout(60_000);
        server.mode = "stall";
        await createStoryAndChapter(page, "Real — left mid-reply", "One");
        await page.getByRole("button", { name: "Brainstorm" }).click();
        await page.getByRole("button", { name: "New chat" }).click();
        await page.getByPlaceholder("Bounce an idea around…").fill("Tell me something");
        await page.getByRole("button", { name: "Send" }).click();
        await expect(page.getByText("The server's own words")).toBeVisible({ timeout: 15_000 });

        await page.getByRole("button", { name: "Write" }).click();
        await page.getByRole("button", { name: "Brainstorm" }).click();
        await page.getByText("Chat 1", { exact: true }).click();
        await expect(page.getByText("Tell me something")).toBeVisible();
        await expect(page.getByText("The server's own words")).toBeVisible();
        await expect(page.getByText(/Incomplete — cut short/)).toBeVisible();
    });

    test("a pause mid-stream is shown while it lasts", async ({ page }) => {
        test.setTimeout(60_000);
        server.mode = "stall";
        const sheet = await reworkWithRealServer(page, "Real — stall");
        await expect(sheet.getByText(/No new text for/)).toBeVisible({ timeout: 15_000 });
        await expect(sheet.getByText("The server's own words, finished.")).toBeVisible({ timeout: 15_000 });
    });
});
