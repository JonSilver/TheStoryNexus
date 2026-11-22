import { expect, test } from "@playwright/test";
import { useFakeModelServer } from "./fakeModelServer";
import { reworkAll } from "./helpers";

test.describe.configure({ mode: "serial" });

/**
 * Choosing models against a real model server: settings, model lists and
 * favourites, and the action sheet's model, with the backend resolving it.
 */
test.describe("against a real model server", () => {
    const { server, reworkWithRealServer } = useFakeModelServer();

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
        // Search matches what the writer sees (names, ids, providers), nothing internal
        await page.getByPlaceholder("Search models…").fill("all");
        await expect(page.getByText("No model matches.")).toBeVisible();
        await page.getByPlaceholder("Search models…").fill("zeta");
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

    test("quick stars on a slow connection all show at once and all stick", async ({ page }) => {
        await page.goto("/settings/providers");
        await page.route(/\/api\/ai\/settings\/[^/]+$/, async route => {
            await new Promise(resolve => setTimeout(resolve, 800));
            await route.continue();
        });
        await page.getByLabel("Default model").click();
        const group = page.getByRole("group", { name: "Local" });
        for (const name of ["alpha-model", "fake-model"])
            await group.getByRole("button", { name: `Favourite ${name}` }).click();
        // Both starred before either save has answered
        for (const name of ["alpha-model", "fake-model"])
            await expect(group.getByRole("button", { name: `Unfavourite ${name}` })).toBeVisible({ timeout: 500 });
        await expect
            .poll(async () => (await (await page.request.get("/api/ai/settings")).json()).favouriteModels.length)
            .toBe(3);
        await page.reload();
        await page.getByLabel("Default model").click();
        await expect(page.getByRole("group", { name: "Favourites" }).getByRole("option")).toHaveCount(3);
    });

    test("the sheet names the model, and a model chosen there is tried at once and kept for the action", async ({
        page
    }) => {
        server.mode = "by-model";
        const sheet = await reworkWithRealServer(page, "Real — change model");
        const storyId = new URL(page.url()).pathname.split("/")[2];
        const pick = async (name: string) =>
            page
                .getByRole("option", { name: new RegExp(name) })
                .first()
                .click();
        try {
            await expect(sheet.getByText("Model: fake-model (your default model)")).toBeVisible();
            await expect(sheet.getByText(/reads like the model's notes/)).toBeVisible();

            // From the warning, straight to the model list; choosing tries again with it
            await sheet.getByRole("button", { name: "Use a different model for Rework" }).click();
            await pick("alpha-model");
            await expect(sheet.getByText("A steadier sentence from alpha-model.")).toBeVisible();
            await expect(sheet.getByText("Model: alpha-model (chosen for all stories)")).toBeVisible();
            expect(server.lastModel).toBe("alpha-model");
            // The first attempt is kept, and still says who wrote it
            await expect(sheet.getByText("Attempt 2 of 2")).toBeVisible();
            await sheet.getByRole("button", { name: "Previous attempt" }).click();
            await expect(sheet.getByText("Model: fake-model (your default model)")).toBeVisible();
            await expect(sheet.getByText(/Revisions made/)).toBeVisible();
            await sheet.getByRole("button", { name: "Discard" }).click();

            // Rework uses it from now on, and Settings says so
            await reworkAll(page);
            await expect(sheet.getByText("A steadier sentence from alpha-model.")).toBeVisible();
            await expect(sheet.getByText(/reads like the model's notes/)).toHaveCount(0);
            await sheet.getByRole("button", { name: "Discard" }).click();
            await page.goto("/settings/actions");
            await expect(page.getByRole("button", { name: /^Rework/ })).toContainText("built-in · model: alpha-model");

            // A story with its own model for the action: the change is saved there, not under all stories
            const own = await page.request.put("/api/actions/overrides", {
                data: { actionId: "rework", storyId, modelRef: "local::local/zeta-model", temperature: 0.3 }
            });
            expect(own.ok()).toBe(true);
            await page.goto(`/story/${storyId}/write`);
            await reworkAll(page);
            await expect(sheet.getByText("Model: zeta-model (chosen for this story)")).toBeVisible();
            await sheet.getByRole("button", { name: "Change model" }).click();
            await pick("fake-model");
            await expect(sheet.getByText("Model: fake-model (chosen for this story)")).toBeVisible();
            expect(server.lastModel).toBe("fake-model");
            await sheet.getByRole("button", { name: "Discard" }).click();

            // Refused before it started (no model named): the story's own choice is still the one changed
            await page.route(
                "**/api/generate/action",
                route =>
                    route.fulfill({
                        status: 422,
                        contentType: "application/json",
                        body: JSON.stringify({
                            error: "Prompt template and output size exceed the model's context window"
                        })
                    }),
                { times: 1 }
            );
            await reworkAll(page);
            await expect(sheet.getByText(/exceed the model's context window/)).toBeVisible();
            await sheet.getByRole("button", { name: "Use a different model for Rework" }).click();
            await expect(sheet.getByText(/Model for Rework in this story/)).toBeVisible();
            await pick("zeta-model");
            await expect(sheet.getByText("Model: zeta-model (chosen for this story)")).toBeVisible();
            expect(server.lastModel).toBe("zeta-model");

            const [story] = await (await page.request.get(`/api/actions/overrides?storyId=${storyId}`)).json();
            // Only the model changed: the story's other settings for the action stay
            expect(story).toMatchObject({ modelRef: "local::local/zeta-model", temperature: 0.3 });
            const [global] = await (await page.request.get("/api/actions/overrides")).json();
            expect(global).toMatchObject({ actionId: "rework", modelRef: "local::local/alpha-model" });
            await sheet.getByRole("button", { name: "Discard" }).click();

            // Seen from a story, Settings names the model that actually runs: its own, all stories', or the default
            await page.goto("/settings/actions");
            await page.getByRole("button", { name: /^This story: / }).click();
            await expect(page.getByRole("button", { name: /^Rework/ })).toContainText("model: zeta-model");
            await page.request.delete(`/api/actions/overrides/rework?storyId=${storyId}`);
            await page.reload();
            await page.getByRole("button", { name: /^This story: / }).click();
            await expect(page.getByRole("button", { name: /^Rework/ })).toContainText(
                "model: alpha-model (all stories)"
            );
            await expect(page.getByRole("button", { name: /^Expand/ })).toContainText("model: fake-model (default)");
        } finally {
            await page.request.delete("/api/actions/overrides/rework");
        }
    });
});
