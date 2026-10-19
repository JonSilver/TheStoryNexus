import { describe, expect, it } from "vitest";
import { buildOpenAICompatiblePayload, openAIContextLength } from "./providers.js";

const base = {
    provider: "local" as const,
    modelId: "local/qwen3:8b",
    messages: [{ role: "user" as const, content: "hi" }],
    temperature: 0.7,
    maxTokens: 512
};

describe("buildOpenAICompatiblePayload", () => {
    it("omits unset optional samplers entirely", () => {
        const payload = buildOpenAICompatiblePayload(base);
        expect(payload).not.toHaveProperty("top_p");
        expect(payload).not.toHaveProperty("frequency_penalty");
        expect(payload).not.toHaveProperty("presence_penalty");
        expect(payload.max_tokens).toBe(512);
    });

    it("includes set samplers under snake_case names", () => {
        const payload = buildOpenAICompatiblePayload({
            ...base,
            topP: 0.9,
            frequencyPenalty: 0.4,
            presencePenalty: -0.2
        });
        expect(payload.top_p).toBe(0.9);
        expect(payload.frequency_penalty).toBe(0.4);
        expect(payload.presence_penalty).toBe(-0.2);
    });

    it("strips the local/ prefix for local models", () => {
        expect(buildOpenAICompatiblePayload(base).model).toBe("qwen3:8b");
    });

    it("modern OpenAI models get max_completion_tokens instead of max_tokens", () => {
        const payload = buildOpenAICompatiblePayload({ ...base, provider: "openai", modelId: "gpt-5.2" });
        expect(payload).not.toHaveProperty("max_tokens");
        expect(payload.max_completion_tokens).toBe(512);
        const classic = buildOpenAICompatiblePayload({ ...base, provider: "openai", modelId: "gpt-4o" });
        expect(classic.max_tokens).toBe(512);
        expect(classic).not.toHaveProperty("max_completion_tokens");
    });

    it("OpenAI reasoning models (gpt-5, o-series incl. o4) get max_completion_tokens and no samplers", () => {
        for (const modelId of ["gpt-5.2", "o1", "o3-mini", "o4-mini"]) {
            const payload = buildOpenAICompatiblePayload({
                ...base,
                provider: "openai",
                modelId,
                temperature: 0.2,
                topP: 0.9
            });
            expect(payload).toEqual({ model: modelId, messages: expect.any(Array), max_completion_tokens: 512 });
        }
    });

    it("a zero-valued sampler is still sent (falsy ≠ unset)", () => {
        const payload = buildOpenAICompatiblePayload({ ...base, topP: 0, frequencyPenalty: 0 });
        expect(payload.top_p).toBe(0);
        expect(payload.frequency_penalty).toBe(0);
    });
});

describe("openAIContextLength", () => {
    it("maps modern models to their real windows, not 4096", () => {
        expect(openAIContextLength("gpt-5")).toBe(256_000);
        expect(openAIContextLength("gpt-5-mini")).toBe(256_000);
        expect(openAIContextLength("o1-preview")).toBe(128_000);
        expect(openAIContextLength("o3-mini")).toBe(128_000);
        expect(openAIContextLength("gpt-4o-2024-11-20")).toBe(128_000);
        expect(openAIContextLength("gpt-4.1-nano")).toBe(256_000);
    });

    it("keeps legacy models at their documented limits", () => {
        expect(openAIContextLength("gpt-4")).toBe(8_192);
        expect(openAIContextLength("gpt-4-32k")).toBe(32_768);
        expect(openAIContextLength("gpt-3.5-turbo")).toBe(16_384);
    });

    it("defaults unknown models high, never 4096", () => {
        expect(openAIContextLength("some-future-model")).toBe(128_000);
    });
});
