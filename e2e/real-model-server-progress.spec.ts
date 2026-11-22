import { expect, test } from "@playwright/test";
import { useFakeModelServer } from "./fakeModelServer";
import { createStoryAndChapter } from "./helpers";

test.describe.configure({ mode: "serial" });

/**
 * Progress and failures against a real model server: the app's own backend —
 * not a browser-side mock — classifies failures and narrates progress.
 */
test.describe("against a real model server", () => {
    const { server, reworkWithRealServer } = useFakeModelServer();

    test("a slow start shows the waiting state, then the text", async ({ page }) => {
        server.mode = "slow-start";
        const sheet = await reworkWithRealServer(page, "Real — slow start");
        await expect(sheet.getByText(/Waiting for the model server to respond/)).toBeVisible();
        await expect(sheet.getByText("The server's own words, finished.")).toBeVisible();
    });

    test("a missing model is named, with what to fix", async ({ page }) => {
        server.mode = "missing-model";
        const sheet = await reworkWithRealServer(page, "Real — missing model");
        await expect(sheet.getByText(/^fake-model on the local server.*doesn't have this model/)).toBeVisible();
        // The fix is offered where the failure is
        await expect(sheet.getByRole("button", { name: "Use a different model for Rework" })).toBeVisible();
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
