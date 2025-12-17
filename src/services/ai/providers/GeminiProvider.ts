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

        // Only gemini-* models support native systemInstruction
        const supportsSystemInstruction = model.startsWith("gemini-");
        const { systemInstruction, contents } = this.convertMessages(messages, supportsSystemInstruction);

        const stream = await this.client.models.generateContentStream({
            model,
            contents,
            config: {
                ...(supportsSystemInstruction && systemInstruction && { systemInstruction }),
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

    private convertMessages(
        messages: PromptMessage[],
        supportsSystemInstruction: boolean
    ): {
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

        // For models without native system instruction support, prepend to first user message
        if (!supportsSystemInstruction && systemInstruction && contents.length > 0) {
            const firstUserIdx = contents.findIndex(c => c.role === "user");
            if (firstUserIdx !== -1) {
                const original = contents[firstUserIdx].parts[0].text;
                contents[firstUserIdx].parts[0].text = `${systemInstruction}\n\n${original}`;
            }
            return { systemInstruction: undefined, contents };
        }

        return { systemInstruction, contents };
    }
}
