import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { aiService } from "@/services/ai/AIService";
import { adminApi } from "@/services/api/client";
import type { AIModel, AIProvider, AISettings } from "@/types/story";

export const aiSettingsKeys = {
    all: ["ai"] as const,
    settings: () => [...aiSettingsKeys.all, "settings"] as const,
    models: () => [...aiSettingsKeys.all, "models"] as const,
    modelsByProvider: (provider: AIProvider) => [...aiSettingsKeys.models(), provider] as const
};

export const useAISettingsQuery = () =>
    useQuery<AISettings>({
        queryKey: aiSettingsKeys.settings(),
        queryFn: async () => {
            await aiService.initialize();
            const settings = aiService.getSettings();
            if (!settings) throw new Error("Failed to load AI settings");
            return settings;
        },
        staleTime: 5 * 60 * 1000
    });

export const useAvailableModelsQuery = (provider?: AIProvider) =>
    useQuery<AIModel[]>({
        queryKey: provider ? aiSettingsKeys.modelsByProvider(provider) : aiSettingsKeys.models(),
        queryFn: async () => {
            await aiService.initialize();
            return aiService.getAvailableModels(provider, false);
        },
        staleTime: 5 * 60 * 1000
    });

type UpdateAPIKeyParams = { provider: AIProvider; key: string };

export const useUpdateAPIKeyMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ provider, key }: UpdateAPIKeyParams) => {
            await aiService.updateKey(provider, key);
            return aiService.getAvailableModels(provider, true);
        },
        onSuccess: (models, { provider }) => {
            queryClient.invalidateQueries({ queryKey: aiSettingsKeys.settings() });
            queryClient.invalidateQueries({ queryKey: aiSettingsKeys.models() });
            queryClient.setQueryData(aiSettingsKeys.modelsByProvider(provider), models);
            toast.success(`${providerName(provider)} models updated`);
        },
        onError: (_, { provider }) => {
            toast.error(`Failed to update ${providerName(provider)} key`);
        }
    });
};

export const useUpdateLocalApiUrlMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (url: string) => {
            await aiService.updateLocalApiUrl(url);
            return aiService.getAvailableModels("local", true);
        },
        onSuccess: models => {
            queryClient.invalidateQueries({ queryKey: aiSettingsKeys.settings() });
            queryClient.invalidateQueries({ queryKey: aiSettingsKeys.models() });
            queryClient.setQueryData(aiSettingsKeys.modelsByProvider("local"), models);
            toast.success("Local API URL updated");
        },
        onError: () => {
            toast.error("Failed to update local API URL");
        }
    });
};

type UpdateDefaultModelParams = { provider: AIProvider; modelId: string | undefined };

export const useUpdateDefaultModelMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ provider, modelId }: UpdateDefaultModelParams) => {
            await aiService.updateDefaultModel(provider, modelId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: aiSettingsKeys.settings() });
            toast.success("Default model updated");
        },
        onError: () => {
            toast.error("Failed to update default model");
        }
    });
};

export const useRefreshModelsMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (provider: AIProvider) => {
            const models = await aiService.getAvailableModels(provider, true);
            return { provider, models };
        },
        onSuccess: ({ provider, models }) => {
            queryClient.invalidateQueries({ queryKey: aiSettingsKeys.settings() });
            queryClient.setQueryData(aiSettingsKeys.modelsByProvider(provider), models);
            toast.success(`${providerName(provider)} models refreshed`);
        },
        onError: (_, provider) => {
            toast.error(`Failed to refresh ${providerName(provider)} models`);
        }
    });
};

export const useDeleteDemoDataMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => adminApi.deleteDemoData(),
        onSuccess: ({ deleted }) => {
            queryClient.invalidateQueries();
            toast.success(
                `Demo data deleted: ${deleted.stories} ${deleted.stories === 1 ? "story" : "stories"}, ${deleted.lorebookEntries} lorebook ${deleted.lorebookEntries === 1 ? "entry" : "entries"}`
            );
        },
        onError: () => {
            toast.error("Failed to delete demo data");
        }
    });
};

const providerName = (provider: AIProvider): string => {
    const names: Record<AIProvider, string> = {
        openai: "OpenAI",
        openrouter: "OpenRouter",
        local: "Local"
    };
    return names[provider];
};
