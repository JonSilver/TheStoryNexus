import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type GenerationEvent, describeProviderError, runGeneration } from "./generationRun.js";

const TARGET = "skyfall on the local server at 10.0.0.1:11434";
const timeouts = { acceptMs: 10_000, firstTokenMs: 8_000, stallMs: 5_000, heartbeatMs: 1_000 };

const tokens = async function* (items: string[], gapMs = 0) {
    for (const item of items) {
        if (gapMs) await new Promise(resolve => setTimeout(resolve, gapMs));
        yield item;
    }
};

const run = (open: (signal: AbortSignal) => Promise<AsyncIterable<string>>, extra = {}) => {
    const events: GenerationEvent[] = [];
    const controller = new AbortController();
    const done = runGeneration({
        open,
        signal: controller.signal,
        emit: event => events.push(event),
        target: TARGET,
        timeouts,
        ...extra
    });
    return { events, controller, done };
};

const never = (signal: AbortSignal) =>
    new Promise<AsyncIterable<string>>((_, reject) =>
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))
    );

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("runGeneration", () => {
    it("streams tokens and finishes, narrating phases", async () => {
        const { events, done } = run(async () => tokens(["Hello", " world"]));
        await vi.runAllTimersAsync();
        await done;
        const phases = events.filter(e => e.type === "status").map(e => (e as { phase: string }).phase);
        expect(phases).toContain("waiting");
        expect(phases).toContain("streaming");
        expect(
            events
                .filter(e => e.type === "token")
                .map(e => (e as { text: string }).text)
                .join("")
        ).toBe("Hello world");
        expect(events.at(-1)).toEqual({ type: "finish" });
    });

    it("heartbeats while the provider hasn't accepted, then fails with a specific message", async () => {
        const { events, done } = run(never);
        await vi.advanceTimersByTimeAsync(timeouts.acceptMs + 100);
        await done;
        const heartbeats = events.filter(e => e.type === "status" && e.phase === "waiting");
        expect(heartbeats.length).toBeGreaterThanOrEqual(5);
        const last = events.at(-1) as { type: string; message: string };
        expect(last.type).toBe("error");
        expect(last.message).toContain(TARGET);
        expect(last.message).toContain("didn't start responding");
    });

    it("fails when accepted but no text arrives", async () => {
        const silentStream = async () =>
            (async function* () {
                await new Promise(() => undefined);
                yield "";
            })();
        const { events, done } = run(silentStream);
        await vi.advanceTimersByTimeAsync(timeouts.firstTokenMs + 100);
        await done;
        const last = events.at(-1) as { type: string; message: string };
        expect(last.message).toContain("accepted the request but produced no text");
    });

    it("fails on a mid-stream stall and keeps what arrived", async () => {
        const stalling = async () =>
            (async function* () {
                yield "Partial prose";
                await new Promise(() => undefined);
            })();
        const { events, done } = run(stalling);
        await vi.advanceTimersByTimeAsync(timeouts.stallMs + 100);
        await done;
        expect(events.some(e => e.type === "token" && e.text === "Partial prose")).toBe(true);
        expect((events.at(-1) as { message: string }).message).toContain("stopped sending text");
    });

    it("reports a provider error immediately, in writer terms", async () => {
        const notFound = async () => {
            throw Object.assign(new Error("404 model 'qwen3:8b' not found"), { status: 404 });
        };
        const { events, done } = run(notFound, { modelSourceHint: "the Summarise Chapter override" });
        await vi.advanceTimersByTimeAsync(10);
        await done;
        const last = events.at(-1) as { type: string; message: string };
        expect(last.type).toBe("error");
        expect(last.message).toContain("doesn't have this model");
        expect(last.message).toContain("the Summarise Chapter override");
    });

    it("treats a clean stream with no text as a failure", async () => {
        const { events, done } = run(async () => tokens(["", "  "]));
        await vi.runAllTimersAsync();
        await done;
        expect((events.at(-1) as { message: string }).message).toContain("without producing any text");
    });

    it("reports aborted, not an error, when the writer stops", async () => {
        const { events, controller, done } = run(never);
        await vi.advanceTimersByTimeAsync(1_500);
        controller.abort();
        await vi.advanceTimersByTimeAsync(10);
        await done;
        expect(events.at(-1)).toEqual({ type: "aborted" });
    });

    it("whitespace trickling in doesn't count as text: the first-text deadline still applies", async () => {
        const trickle = async () =>
            (async function* () {
                for (;;) {
                    await new Promise(resolve => setTimeout(resolve, 1_000));
                    yield "\n";
                }
            })();
        const { events, done } = run(trickle);
        await vi.advanceTimersByTimeAsync(timeouts.firstTokenMs + 1_500);
        await done;
        expect(events.some(e => e.type === "status" && e.phase === "streaming")).toBe(false);
        const last = events.at(-1) as { type: string; message: string };
        expect(last.message).toContain("accepted the request but produced no text");
    });

    it("while streaming, the heartbeat says how long since text last arrived", async () => {
        const pausing = async () =>
            (async function* () {
                yield "Hello";
                await new Promise(resolve => setTimeout(resolve, 3_500));
                yield " world";
            })();
        const { events, done } = run(pausing);
        await vi.advanceTimersByTimeAsync(4_000);
        await done;
        const idle = events
            .filter(e => e.type === "status" && e.phase === "streaming" && "idleMs" in e)
            .map(e => (e as { idleMs: number }).idleMs);
        expect(Math.max(...idle)).toBeGreaterThanOrEqual(3_000);
        expect(events.at(-1)).toEqual({ type: "finish" });
    });
});

describe("describeProviderError", () => {
    it("explains unreachable servers", () => {
        const message = describeProviderError(
            Object.assign(new Error("Connection error."), { cause: { code: "ECONNREFUSED" } }),
            TARGET
        );
        expect(message).toContain("couldn't reach the model server");
        expect(message).toContain("ECONNREFUSED");
    });

    it("explains rejected keys, rate limits and server errors", () => {
        expect(describeProviderError({ status: 401, message: "bad key" }, TARGET)).toContain("API key was rejected");
        expect(describeProviderError({ status: 429 }, TARGET)).toContain("rate-limiting");
        expect(describeProviderError({ status: 503, message: "loading" }, TARGET)).toContain("error 503");
    });
});
