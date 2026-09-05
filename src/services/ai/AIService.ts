import { attemptPromise } from "@jfdi/attempt";
import { aiSettingsSchema } from "@/schemas/entities";
import type { AIModel, AIProvider, AISettings, PromptMessage } from "@/types/story";
import { logger } from "@/utils/logger";
import { aiApi } from "../api/client";
import { createSSEParser } from "./sseParser";
import { randomUUID } from "@/utils/crypto";

/**
 * Client-side facade over the server's AI endpoints. All provider access,
 * key handling, and upstream streaming happen server-side; this module only
 * posts generation requests and parses the server's SSE stream.
 */
const state: {
    settings: AISettings | null;
    activeRequestId: string | null;
    fetchController: AbortController | null;
} = {
    settings: null,
    activeRequestId: null,
    fetchController: null
};

const initialize = async (): Promise<void> => {
    const [error, settings] = await attemptPromise(() => aiApi.getSettings());
    if (error) {
        logger.error("[AIService] Failed to fetch settings from API", error);
        throw error;
    }
    state.settings = settings;
};

const getSettings = (): AISettings | null => state.settings;

const generate = async (
    providerType: AIProvider,
    messages: PromptMessage[],
    modelId: string,
    temperature: number = 1.0,
    maxTokens: number = 2048
): Promise<Response> => {
    const requestId = randomUUID();
    const controller = new AbortController();
    state.activeRequestId = requestId;
    state.fetchController = controller;

    const [error, response] = await attemptPromise(() =>
        fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId, provider: providerType, modelId, messages, temperature, maxTokens }),
            signal: controller.signal
        })
    );

    if (error) {
        if ((error as Error).name === "AbortError") return new Response(null, { status: 204 });
        throw error;
    }
    if (!response) throw new Error("No response from server");
    return response;
};

/**
 * Reads the server's generation SSE stream. Stream end without a terminal
 * frame surfaces as an error — truncated output never passes as success.
 */
const handleStreamedResponse = async (
    response: Response,
    onToken: (text: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
): Promise<void> => {
    if (response.status === 204 || !response.body) {
        onComplete();
        return;
    }
    if (!response.ok) {
        const [, body] = await attemptPromise(() => response.json());
        state.activeRequestId = null;
        state.fetchController = null;
        onError(new Error(body?.error || `Generation failed (${response.status})`));
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSSEParser({ onToken, onComplete, onError });

    const [error] = await attemptPromise(async () => {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                parser.push(decoder.decode());
                parser.end();
                break;
            }
            parser.push(decoder.decode(value, { stream: true }));
        }
    });

    state.activeRequestId = null;
    state.fetchController = null;

    if (error)
        if ((error as Error).name === "AbortError") {
            logger.info("Stream reading aborted.");
            onComplete();
        } else onError(error as Error);
};

const abortStream = (): void => {
    logger.info("[AIService] Aborting stream");
    const requestId = state.activeRequestId;
    state.fetchController?.abort();
    state.fetchController = null;
    state.activeRequestId = null;
    if (requestId)
        void attemptPromise(() =>
            fetch("/api/generate/abort", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId })
            })
        );
};

const applySettings = (settings: AISettings): AISettings => {
    state.settings = settings;
    return settings;
};

const getAvailableModels = async (provider?: AIProvider, forceRefresh: boolean = true): Promise<AIModel[]> => {
    if (provider && forceRefresh) {
        const [error, refreshed] = await attemptPromise(() => aiApi.refreshModels(provider));
        if (error) {
            logger.error("Error fetching models:", error);
            throw error;
        }
        applySettings(refreshed);
    } else {
        const [error, settings] = await attemptPromise(() => aiApi.getSettings());
        if (!error && settings) applySettings(settings);
    }

    const models = state.settings?.availableModels ?? [];
    return provider ? models.filter(m => m.provider === provider) : models;
};

const updateKey = async (provider: AIProvider, key: string): Promise<void> => {
    logger.info(`[AIService] Updating key for provider: ${provider}`);
    const [error, settings] = await attemptPromise(() => aiApi.setKey(provider, key));
    if (error) throw error;
    applySettings(settings);
};

const updateLocalApiUrl = async (url: string): Promise<void> => {
    const [error, settings] = await attemptPromise(() => aiApi.setLocalUrl(url));
    if (error) throw error;
    applySettings(settings);
};

const updateSettingsField = async (updateData: Partial<AISettings>): Promise<void> => {
    const settingsId = state.settings?.id;
    if (!settingsId) throw new Error("Settings not initialized");
    const result = aiSettingsSchema.partial().safeParse(updateData);
    if (!result.success) throw new Error(`Invalid AI settings update data: ${result.error.message}`);
    const [error, updated] = await attemptPromise(() => aiApi.updateSettings(settingsId, updateData));
    if (error) {
        logger.error("[AIService] Failed to update settings via API", error);
        throw error;
    }
    applySettings(updated);
};

const DEFAULT_MODEL_FIELDS: Record<AIProvider, keyof AISettings> = {
    local: "defaultLocalModel",
    openai: "defaultOpenAIModel",
    openrouter: "defaultOpenRouterModel",
    gemini: "defaultGeminiModel"
};

const updateDefaultModel = async (provider: AIProvider, modelId: string | undefined): Promise<void> =>
    updateSettingsField({
        [DEFAULT_MODEL_FIELDS[provider]]: modelId,
        // Choosing a default in Settings means THE default: the global
        // provider/model pair is what every v2 action resolves against
        ...(modelId ? { defaultProvider: provider, defaultModelId: modelId } : {})
    });

export const aiService = {
    initialize,
    getSettings,
    generate,
    handleStreamedResponse,
    abortStream,
    getAvailableModels,
    updateKey,
    updateLocalApiUrl,
    updateDefaultModel
};
