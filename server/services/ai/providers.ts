import { attemptPromise } from "@jfdi/attempt";
import { GoogleGenAI } from "@google/genai";
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
    return new OpenAI(config);
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

export async function* streamCompletion(request: GenerationRequest, settings: ProviderSettings): AsyncGenerator<string> {
    const { provider, modelId, messages, temperature, maxTokens, signal } = request;

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
                abortSignal: signal
            }
        });
        for await (const chunk of stream) if (chunk.text) yield chunk.text;
        return;
    }

    const client = openAICompatibleClient(provider, settings);
    const model = provider === "local" ? modelId.replace(/^local\//, "") : modelId;
    // Newer OpenAI models reject max_tokens
    const omitMaxTokens = provider === "openai" && /^(gpt-5|o1|o3)/.test(model);
    const stream = await client.chat.completions.create(
        {
            model,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            temperature,
            ...(omitMaxTokens ? {} : { max_tokens: maxTokens }),
            stream: true
        },
        { signal }
    );
    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) yield content;
    }
}

const FALLBACK_LOCAL_MODEL: AIModel = {
    id: "local",
    name: "Local Model",
    provider: "local",
    contextLength: 16384,
    enabled: true
};

const openAIContextLength = (modelId: string): number => {
    if (modelId.includes("gpt-4")) return 8192;
    if (modelId.includes("gpt-3.5-turbo-16k")) return 16384;
    return 4096;
};

export const fetchModelsForProvider = async (provider: AIProviderId, settings: ProviderSettings): Promise<AIModel[]> => {
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
        const [error, response] = await attemptPromise(() => fetch(`${localBaseUrl(settings)}/models`));
        if (error || !response?.ok) return [FALLBACK_LOCAL_MODEL];
        const [jsonError, result] = await attemptPromise<{ data: Array<{ id: string }> }>(() => response.json());
        if (jsonError || !result?.data) return [FALLBACK_LOCAL_MODEL];
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
