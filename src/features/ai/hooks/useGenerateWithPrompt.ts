import { attemptPromise } from "@jfdi/attempt";
import { useCallback } from "react";
import { usePromptParser } from "@/features/prompts/hooks/usePromptParser";
import { aiService } from "@/services/ai/AIService";
import { promptsApi } from "@/services/api/client";
import type { AllowedModel, PromptParserConfig } from "@/types/story";
import { generateWithProvider } from "../services/aiGenerationHelper";

export function useGenerateWithPrompt() {
    const { parsePrompt } = usePromptParser();

    const generateWithPrompt = useCallback(
        async (config: PromptParserConfig, selectedModel: AllowedModel): Promise<Response> => {
            await aiService.initialize();

            const { messages, error } = await parsePrompt(config);

            if (error || !messages.length) throw new Error(error || "Failed to parse prompt");

            const [fetchError, prompt] = await attemptPromise(() => promptsApi.getById(config.promptId));

            if (fetchError) throw fetchError;

            return generateWithProvider(selectedModel.provider, messages, selectedModel.id, {
                temperature: prompt?.temperature ?? 0.7,
                maxTokens: prompt?.maxTokens ?? 2048,
                top_p: prompt?.top_p,
                top_k: prompt?.top_k,
                repetition_penalty: prompt?.repetition_penalty,
                min_p: prompt?.min_p
            });
        },
        [parsePrompt]
    );

    return { generateWithPrompt };
}
