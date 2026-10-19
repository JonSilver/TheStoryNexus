import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi } from "@/services/api/client";
import { aiSettingsKeys } from "@/services/api/queryKeys";
import type { AIProvider, AISettings } from "@/types/story";

/** The server's answer to a model-list refresh says whether it had to replace a default that vanished. */
type RefreshedSettings = AISettings & { healedDefault?: string | null };

export const PROVIDER_NAMES: Record<AIProvider, string> = {
    openai: "OpenAI",
    openrouter: "OpenRouter",
    gemini: "Google Gemini",
    local: "Local"
};

export const DEFAULT_MODEL_FIELDS: Record<AIProvider, keyof AISettings> = {
    local: "defaultLocalModel",
    openai: "defaultOpenAIModel",
    openrouter: "defaultOpenRouterModel",
    gemini: "defaultGeminiModel"
};

export const useAISettingsQuery = () =>
    useQuery({ queryKey: aiSettingsKeys.settings, queryFn: aiApi.getSettings, staleTime: 5 * 60 * 1000 });

/** Every settings write answers with the whole settings row: it replaces the cached one. */
const useSettingsWrite = <TVariables>(
    mutationFn: (variables: TVariables) => Promise<RefreshedSettings>,
    failure: string
) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: settings => queryClient.setQueryData(aiSettingsKeys.settings, settings),
        meta: { failure }
    });
};

/** Saving a key also loads that provider's models with it. */
export const useUpdateAPIKeyMutation = () =>
    useSettingsWrite(async ({ provider, key }: { provider: AIProvider; key: string }) => {
        await aiApi.setKey(provider, key);
        return aiApi.refreshModels(provider);
    }, "Couldn't save the key");

/** Saving the URL tests the connection by loading the server's models. */
export const useUpdateLocalApiUrlMutation = () =>
    useSettingsWrite(async (url: string) => {
        await aiApi.setLocalUrl(url);
        return aiApi.refreshModels("local");
    }, "Couldn't reach that local model server");

export const useRefreshModelsMutation = () =>
    useSettingsWrite((provider: AIProvider) => aiApi.refreshModels(provider), "Couldn't load the models");

/** A default chosen in Settings is THE default: every action resolves against the global provider/model pair. */
export const useUpdateDefaultModelMutation = () => {
    const queryClient = useQueryClient();
    return useSettingsWrite(({ provider, modelId }: { provider: AIProvider; modelId: string | undefined }) => {
        const settings = queryClient.getQueryData<AISettings>(aiSettingsKeys.settings);
        if (!settings) throw new Error("Settings haven't loaded yet");
        return aiApi.updateSettings(settings.id, {
            [DEFAULT_MODEL_FIELDS[provider]]: modelId,
            ...(modelId ? { defaultProvider: provider, defaultModelId: modelId } : {})
        });
    }, "Couldn't change the default model");
};
