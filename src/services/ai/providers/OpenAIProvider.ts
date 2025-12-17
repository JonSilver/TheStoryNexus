import { attemptPromise } from "@jfdi/attempt";
import OpenAI from "openai";
import type { AIModel, AIProvider, PromptMessage } from "@/types/story";
import { logger } from "@/utils/logger";
import { wrapOpenAIStream } from "../streamUtils";
import type { IAIProvider } from "./IAIProvider";

export class OpenAIProvider implements IAIProvider {
    private client: OpenAI | null = null;

    initialize(apiKey?: string): void {
        if (!apiKey) return;

        this.client = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true
        });
    }

    async fetchModels(): Promise<AIModel[]> {
        if (!this.client) {
            logger.warn("[OpenAIProvider] Client not initialized");
            return [];
        }

        logger.info("[OpenAIProvider] Fetching models");

        const client = this.client;
        const [error, response] = await attemptPromise(() => client.models.list());

        if (error) {
            logger.error("[OpenAIProvider] Error fetching models:", error);
            return [];
        }

        const gptModels = response.data.filter(m => m.id.startsWith("gpt"));

        const models: AIModel[] = gptModels.map(model => ({
            id: model.id,
            name: model.id,
            provider: "openai" as AIProvider,
            contextLength: this.getContextLength(model.id),
            enabled: true
        }));

        logger.info(`[OpenAIProvider] Fetched ${models.length} models`);
        return models;
    }

    async generate(
        messages: PromptMessage[],
        model: string,
        temperature: number,
        maxTokens: number,
        signal?: AbortSignal
    ): Promise<Response> {
        if (!this.client) 
            throw new Error("OpenAI client not initialized");
        

        const client = this.client;

        // Try without max_tokens first for gpt-5+ models, they don't support it
        // For older models, include max_tokens
        const isNewModel = model.startsWith("gpt-5") || model.startsWith("o1") || model.startsWith("o3");

        const stream = await client.chat.completions.create(
            {
                model,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature,
                ...(isNewModel ? {} : { max_tokens: maxTokens }),
                stream: true
            },
            { signal }
        );

        return wrapOpenAIStream(stream);
    }

    isInitialized(): boolean {
        return this.client !== null;
    }

    private getContextLength(modelId: string): number {
        if (modelId.includes("gpt-4")) return 8192;
        if (modelId.includes("gpt-3.5-turbo-16k")) return 16384;
        if (modelId.includes("gpt-3.5")) return 4096;
        return 4096;
    }
}
