import { attemptPromise } from "@jfdi/attempt";
import { GoogleGenAI } from "@google/genai";
import type { AIModel, AIProvider, PromptMessage } from "@/types/story";
import { logger } from "@/utils/logger";
import { wrapGeminiStream } from "../streamUtils";
import type { IAIProvider } from "./IAIProvider";

export class GeminiProvider implements IAIProvider {
    private client: GoogleGenAI | null = null;

    initialize(apiKey?: string): void {
        if (!apiKey) return;

        this.client = new GoogleGenAI({ apiKey });
    }

    async fetchModels(): Promise<AIModel[]> {
        if (!this.client) {
            logger.warn("[GeminiProvider] Client not initialized");
            return [];
        }

        logger.info("[GeminiProvider] Fetching models");

        const client = this.client;
        const [error, pager] = await attemptPromise(() => client.models.list());

        if (error) {
            logger.error("[GeminiProvider] Error fetching models:", error);
            return [];
        }

        const models: AIModel[] = [];

        const [iterError] = await attemptPromise(async () => {
            for await (const model of pager) {
                if (!model.name || !model.supportedActions?.includes("generateContent")) continue;

                const modelId = model.name.replace("models/", "");

                // Only include official Gemini models - third-party models (gemma, learnlm, etc.)
                // don't support system instructions which our prompts require
                if (!modelId.startsWith("gemini-")) continue;

                models.push({
                    id: modelId,
                    name: model.displayName || modelId,
                    provider: "gemini" as AIProvider,
                    contextLength: model.inputTokenLimit || 32768,
                    enabled: true
                });
            }
        });

        if (iterError) {
            logger.error("[GeminiProvider] Error iterating models:", iterError);
            return [];
        }

        logger.info(`[GeminiProvider] Fetched ${models.length} models`);
        return models;
    }

    async generate(
        messages: PromptMessage[],
        model: string,
        temperature: number,
        maxTokens: number,
        signal?: AbortSignal
    ): Promise<Response> {
        if (!this.client) throw new Error("Gemini client not initialized");

        const { systemInstruction, contents } = this.convertMessages(messages);

        const stream = await this.client.models.generateContentStream({
            model,
            contents,
            config: {
                ...(systemInstruction && { systemInstruction }),
                temperature,
                maxOutputTokens: maxTokens,
                abortSignal: signal
            }
        });

        return wrapGeminiStream(stream);
    }

    isInitialized(): boolean {
        return this.client !== null;
    }

    private convertMessages(messages: PromptMessage[]): {
        systemInstruction: string | undefined;
        contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    } {
        let systemInstruction: string | undefined;
        const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

        for (const msg of messages)
            if (msg.role === "system")
                systemInstruction = systemInstruction
                    ? `${systemInstruction}\n${msg.content}`
                    : msg.content;
            else
                contents.push({
                    role: msg.role === "assistant" ? "model" : "user",
                    parts: [{ text: msg.content }]
                });

        return { systemInstruction, contents };
    }
}
