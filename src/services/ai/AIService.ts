import { attemptPromise } from "@jfdi/attempt";
import { aiSettingsSchema } from "@/schemas/entities";
import type { AIModel, AIProvider, AISettings } from "@/types/story";
import { logger } from "@/utils/logger";
import { aiApi } from "../api/client";

/**
 * Client-side facade over the server's AI settings endpoints: keys, model
 * lists, defaults. Generation streams live in v2 (streamAction /
 * useActionGeneration) — this module owns settings only.
 */
const state: { settings: AISettings | null } = { settings: null };

const initialize = async (): Promise<void> => {
    const [error, settings] = await attemptPromise(() => aiApi.getSettings());
    if (error) {
        logger.error("[AIService] Failed to fetch settings from API", error);
        throw error;
    }
    state.settings = settings;
};

const getSettings = (): AISettings | null => state.settings;

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
    getAvailableModels,
    updateKey,
    updateLocalApiUrl,
    updateDefaultModel
};
