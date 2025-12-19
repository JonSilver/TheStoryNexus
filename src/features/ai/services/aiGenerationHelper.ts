import { aiService } from "@/services/ai/AIService";
import type { AIProvider, PromptMessage } from "@/types/story";
import { logger } from "@/utils/logger";
import type { GenerationParams } from "../types/generationParams";

export const generateWithProvider = (
    provider: AIProvider,
    messages: PromptMessage[],
    modelId: string,
    params: GenerationParams
): Promise<Response> => {
    logger.info("AI Generation Request", {
        provider,
        model: modelId,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        messageCount: messages.length,
        promptPreview: messages[0]?.content?.substring(0, 200)
    });

    return aiService.generate(provider, messages, modelId, params.temperature, params.maxTokens);
};
