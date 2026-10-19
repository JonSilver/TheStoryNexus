import { GoogleGenAI } from "@google/genai";
import { attemptPromise } from "@jfdi/attempt";
import OpenAI from "openai";

export type AIProviderId = "openai" | "openrouter" | "gemini" | "local";

export interface PromptMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface AIModel {
    id: string;
    name: string;
    provider: AIProviderId;
    contextLength: number;
    enabled: boolean;
}

export interface ProviderSettings {
    openaiKey?: string | null;
    openrouterKey?: string | null;
    geminiKey?: string | null;
    localApiUrl?: string | null;
}

export interface GenerationRequest {
    provider: AIProviderId;
    modelId: string;
    messages: PromptMessage[];
    temperature: number;
    maxTokens: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    signal: AbortSignal;
}

export const DEFAULT_LOCAL_API_URL = "http://localhost:1234/v1";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const KEY_FIELDS: Record<Exclude<AIProviderId, "local">, keyof ProviderSettings> = {
    openai: "openaiKey",
    openrouter: "openrouterKey",
    gemini: "geminiKey"
};

export const providerKeyField = (provider: Exclude<AIProviderId, "local">) => KEY_FIELDS[provider];

const localBaseUrl = (settings: ProviderSettings) => settings.localApiUrl || DEFAULT_LOCAL_API_URL;

const openAICompatibleClient = (provider: AIProviderId, settings: ProviderSettings): OpenAI => {
    const configs: Record<string, { apiKey: string | undefined; baseURL?: string }> = {
        openai: { apiKey: settings.openaiKey ?? undefined },
        openrouter: { apiKey: settings.openrouterKey ?? undefined, baseURL: OPENROUTER_BASE },
        local: { apiKey: "not-needed", baseURL: localBaseUrl(settings) }
    };
    const config = configs[provider];
    if (!config?.apiKey) throw new Error(`${provider} API key not set`);
    // No hidden SDK retries: a retried 5xx/connection error turns a fast, clear
    // failure into a slow vague one. Timeouts are owned by the generation
    // runner, which knows what phase it's in; the SDK's 10-minute default
    // would only ever mask that.
    return new OpenAI({ ...config, maxRetries: 0, timeout: 60 * 60_000 });
};

// Only gemini-* models support native systemInstruction; others get it prepended to the first user message
const convertGeminiMessages = (messages: PromptMessage[], supportsSystemInstruction: boolean) => {
    const systemInstruction = messages
        .filter(m => m.role === "system")
        .map(m => m.content)
        .join("\n");
    const contents = messages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

    if (!supportsSystemInstruction && systemInstruction && contents.length > 0) {
        const firstUser = contents.find(c => c.role === "user");
        if (firstUser) firstUser.parts[0].text = `${systemInstruction}\n\n${firstUser.parts[0].text}`;
        return { systemInstruction: undefined, contents };
    }
    return { systemInstruction: systemInstruction || undefined, contents };
};

/**
 * Pure payload builder for the OpenAI-compatible family. Unset optional
 * samplers are OMITTED (the model server's own tuning applies); OpenAI's
 * reasoning models reject max_tokens but accept max_completion_tokens, so the
 * budgeted output cap always reaches the provider.
 */
export const buildOpenAICompatiblePayload = (request: Omit<GenerationRequest, "signal">) => {
    const { provider, modelId, messages, temperature, maxTokens, topP, frequencyPenalty, presencePenalty } = request;
    const model = provider === "local" ? modelId.replace(/^local\//, "") : modelId;
    // OpenAI's reasoning families take max_completion_tokens and reject any
    // non-default sampler, so samplers are omitted for them
    const reasoningOpenAI = provider === "openai" && /^(gpt-5|o\d)/.test(model);
    if (reasoningOpenAI)
        return {
            model,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            max_completion_tokens: maxTokens
        };
    return {
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature,
        max_tokens: maxTokens,
        ...(topP !== undefined && { top_p: topP }),
        ...(frequencyPenalty !== undefined && { frequency_penalty: frequencyPenalty }),
        ...(presencePenalty !== undefined && { presence_penalty: presencePenalty })
    };
};

/**
 * Opens a completion stream. The returned promise resolves only once the
 * provider has ACCEPTED the request (response headers received) — before
 * that the request may be queued, loading a model, or stuck, which the
 * caller reports as a distinct phase. The iterable then yields text tokens.
 */
export const openCompletionStream = async (
    request: GenerationRequest,
    settings: ProviderSettings
): Promise<AsyncIterable<string>> => {
    const { provider, modelId, messages, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, signal } =
        request;

    if (provider === "gemini") {
        if (!settings.geminiKey) throw new Error("gemini API key not set");
        const client = new GoogleGenAI({ apiKey: settings.geminiKey });
        const supportsSystemInstruction = modelId.startsWith("gemini-");
        const { systemInstruction, contents } = convertGeminiMessages(messages, supportsSystemInstruction);
        const stream = await client.models.generateContentStream({
            model: modelId,
            contents,
            config: {
                ...(supportsSystemInstruction && systemInstruction && { systemInstruction }),
                temperature,
                maxOutputTokens: maxTokens,
                ...(topP !== undefined && { topP }),
                ...(frequencyPenalty !== undefined && { frequencyPenalty }),
                ...(presencePenalty !== undefined && { presencePenalty }),
                abortSignal: signal
            }
        });
        return (async function* () {
            for await (const chunk of stream) if (chunk.text) yield chunk.text;
        })();
    }

    const client = openAICompatibleClient(provider, settings);
    const stream = await client.chat.completions.create(
        { ...buildOpenAICompatiblePayload(request), stream: true },
        { signal }
    );
    return (async function* () {
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) yield content;
        }
    })();
};

// OpenAI's models API doesn't report context windows, so this table maps
// model-name fragments to their documented limits — first match wins, most
// specific first. Unknown models default HIGH: every model OpenAI has shipped
// since 2023 has ≥128k, and undershooting silently amputates the writer's
// chapter from the prompt (worse than a provider-side overflow error).
const OPENAI_CONTEXT_LENGTHS: Array<[fragment: string, tokens: number]> = [
    ["gpt-5", 256_000],
    ["gpt-4.1", 256_000],
    ["gpt-4o", 128_000],
    ["gpt-4-turbo", 128_000],
    ["gpt-4-32k", 32_768],
    ["gpt-4", 8_192],
    ["o1", 128_000],
    ["o3", 128_000],
    ["o4", 128_000],
    ["gpt-3.5-turbo-16k", 16_384],
    ["gpt-3.5", 16_384]
];

export const openAIContextLength = (modelId: string): number =>
    OPENAI_CONTEXT_LENGTHS.find(([fragment]) => modelId.includes(fragment))?.[1] ?? 128_000;

export const fetchModelsForProvider = async (
    provider: AIProviderId,
    settings: ProviderSettings
): Promise<AIModel[]> => {
    if (provider === "gemini") {
        if (!settings.geminiKey) return [];
        const client = new GoogleGenAI({ apiKey: settings.geminiKey });
        const [error, pager] = await attemptPromise(() => client.models.list());
        if (error || !pager) throw error ?? new Error("Failed to list Gemini models");
        const models: AIModel[] = [];
        for await (const model of pager) {
            if (!model.name || !model.supportedActions?.includes("generateContent")) continue;
            const modelId = model.name.replace("models/", "");
            models.push({
                id: modelId,
                name: model.displayName || modelId,
                provider: "gemini",
                contextLength: model.inputTokenLimit || 32768,
                enabled: true
            });
        }
        return models;
    }

    if (provider === "local") {
        const base = localBaseUrl(settings);
        // Unreachable must FAIL, not fabricate a phantom model: the UI needs
        // the real error to say "the server can't reach that URL"
        const [error, response] = await attemptPromise(() =>
            fetch(`${base}/models`, { signal: AbortSignal.timeout(8000) })
        );
        if (error) throw new Error(`The server could not reach ${base} (${(error as Error).message})`);
        if (!response.ok) throw new Error(`${base}/models answered ${response.status}`);
        const [jsonError, result] = await attemptPromise<{ data: Array<{ id: string }> }>(() => response.json());
        if (jsonError || !result?.data) throw new Error(`${base}/models did not return an OpenAI-style model list`);
        return result.data.map(model => ({
            id: `local/${model.id}`,
            name: model.id,
            provider: "local" as const,
            contextLength: 16384,
            enabled: true
        }));
    }

    if (provider === "openrouter") {
        const [error, response] = await attemptPromise(() => fetch(`${OPENROUTER_BASE}/models`));
        if (error || !response?.ok) throw error ?? new Error("Failed to fetch OpenRouter models");
        const [jsonError, result] = await attemptPromise<{
            data: Array<{ id: string; name?: string; context_length?: number }>;
        }>(() => response.json());
        if (jsonError || !result) throw jsonError ?? new Error("Failed to parse OpenRouter models");
        return result.data.map(model => ({
            id: model.id,
            name: model.name || model.id,
            provider: "openrouter" as const,
            contextLength: model.context_length || 4096,
            enabled: true
        }));
    }

    const client = openAICompatibleClient("openai", settings);
    const [error, response] = await attemptPromise(() => client.models.list());
    if (error || !response) throw error ?? new Error("Failed to fetch OpenAI models");
    return response.data
        .filter(m => m.id.startsWith("gpt"))
        .map(model => ({
            id: model.id,
            name: model.id,
            provider: "openai" as const,
            contextLength: openAIContextLength(model.id),
            enabled: true
        }));
};
