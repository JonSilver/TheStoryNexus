import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { openCompletionStream } from "./providers.js";

/**
 * Real HTTP against a throwaway OpenAI-compatible server: proves failures
 * surface on the first attempt (no hidden SDK retries or backoff).
 */
const servers: http.Server[] = [];
afterEach(() => servers.splice(0).forEach(server => server.close()));

const fakeServer = (status: number, body: object) =>
    new Promise<{ url: string; hits: () => number }>(resolve => {
        const state = { hits: 0 };
        const server = http.createServer((_req, res) => {
            state.hits += 1;
            res.writeHead(status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(body));
        });
        servers.push(server);
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address() as AddressInfo;
            resolve({ url: `http://127.0.0.1:${port}/v1`, hits: () => state.hits });
        });
    });

const request = (signal = new AbortController().signal) => ({
    provider: "local" as const,
    modelId: "local/some-model",
    messages: [{ role: "user" as const, content: "hi" }],
    temperature: 0.7,
    maxTokens: 64,
    signal
});

describe("openCompletionStream error handling", () => {
    it.each([500, 503, 429])("surfaces a %i on the first attempt, with no retries", async status => {
        const server = await fakeServer(status, { error: { message: "server is unhappy" } });
        const started = Date.now();
        const result = await openCompletionStream(request(), { localApiUrl: server.url }).catch(error => error);
        expect(result).toBeInstanceOf(Error);
        expect((result as { status?: number }).status).toBe(status);
        expect(server.hits()).toBe(1);
        expect(Date.now() - started).toBeLessThan(2_000);
    });

    it("surfaces a 404 for an unknown model immediately", async () => {
        const server = await fakeServer(404, { error: { message: "model 'some-model' not found" } });
        const result = await openCompletionStream(request(), { localApiUrl: server.url }).catch(error => error);
        expect((result as { status?: number }).status).toBe(404);
        expect(server.hits()).toBe(1);
    });
});
