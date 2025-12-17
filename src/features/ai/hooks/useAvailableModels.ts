import { useQuery } from "@tanstack/react-query";
import { aiService } from "@/services/ai/AIService";
import type { AIModel } from "@/types/story";
import { aiSettingsKeys } from "./useAISettingsQuery";

export const useAvailableModels = () =>
    useQuery<AIModel[]>({
        queryKey: aiSettingsKeys.models(),
        queryFn: async () => {
            await aiService.initialize();
            return aiService.getAvailableModels();
        },
        staleTime: 5 * 60 * 1000
    });
