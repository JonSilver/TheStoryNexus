import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi } from "@/services/api/client";
import { aiSettingsKeys } from "@/services/api/queryKeys";
import type { AIProvider, AISettings, ModelChoice } from "@/types/story";

/** The server's answer to a model-list refresh says whether it had to replace a default that vanished. */
type RefreshedSettings = AISettings & { healedDefault?: string | null };

export const PROVIDER_NAMES: Record<AIProvider, string> = {
    openai: "OpenAI",
    openrouter: "OpenRouter",
    gemini: "Google Gemini",
    local: "Local"
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

/** Saving a key also loads that provider's models (the server does both, once). */
export const useUpdateAPIKeyMutation = () =>
    useSettingsWrite(
        ({ provider, key }: { provider: AIProvider; key: string }) => aiApi.setKey(provider, key),
        "Couldn't use that key"
    );

/** Saving the URL tests the connection by loading the server's models (the server does both, once). */
export const useUpdateLocalApiUrlMutation = () =>
    useSettingsWrite((url: string) => aiApi.setLocalUrl(url), "Couldn't reach that local model server");

export const useRefreshModelsMutation = () =>
    useSettingsWrite((provider: AIProvider) => aiApi.refreshModels(provider), "Couldn't load the models");

const settingsWrite = (settings: AISettings | undefined, update: Partial<AISettings>) => {
    if (!settings) throw new Error("Settings haven't loaded yet");
    return aiApi.updateSettings(settings.id, update);
};

/** The app-wide default: every action that doesn't name its own model uses it. */
export const useUpdateDefaultModelMutation = () => {
    const queryClient = useQueryClient();
    return useSettingsWrite(
        ({ provider, modelId }: ModelChoice) =>
            settingsWrite(queryClient.getQueryData<AISettings>(aiSettingsKeys.settings), {
                defaultProvider: provider,
                defaultModelId: modelId
            }),
        "Couldn't change the default model"
    );
};

export const isSameModel = (a: ModelChoice, b: ModelChoice) => a.provider === b.provider && a.modelId === b.modelId;

/**
 * Stars or unstars a model. Shown at once; writes queue one behind another
 * (scope), each built on the list the previous one left, so quick taps can't
 * undo each other. A failure puts the server's list back.
 */
export const useToggleFavouriteModel = () => {
    const queryClient = useQueryClient();
    return useMutation({
        scope: { id: "favourite-models" },
        mutationFn: (model: ModelChoice) => {
            const settings = queryClient.getQueryData<AISettings>(aiSettingsKeys.settings);
            const current = settings?.favouriteModels ?? [];
            const favouriteModels = current.some(f => isSameModel(f, model))
                ? current.filter(f => !isSameModel(f, model))
                : [...current, model];
            if (settings) queryClient.setQueryData(aiSettingsKeys.settings, { ...settings, favouriteModels });
            return settingsWrite(settings, { favouriteModels });
        },
        onError: () => queryClient.invalidateQueries({ queryKey: aiSettingsKeys.settings }),
        meta: { failure: "Couldn't change your favourite models" }
    });
};
