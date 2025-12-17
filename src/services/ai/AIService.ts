import { attemptPromise } from "@jfdi/attempt";
import { formatSSEChunk, formatSSEDone } from "@/constants/aiConstants";
import { API_URLS } from "@/constants/urls";
import { aiSettingsSchema } from "@/schemas/entities";
import type { AIModel, AIProvider, AISettings, PromptMessage } from "@/types/story";
import { logger } from "@/utils/logger";
import { aiApi } from "../api/client";
import { AIProviderFactory } from "./AIProviderFactory";
import type { IAIProvider } from "./providers/IAIProvider";

export class AIService {
    private static instance: AIService;
    private settings: AISettings | null = null;
    private readonly DEFAULT_LOCAL_API_URL = API_URLS.LOCAL_AI_DEFAULT;
    private providerFactory: AIProviderFactory;
    private abortController: AbortController | null = null;

    private constructor() {
        this.providerFactory = new AIProviderFactory(this.DEFAULT_LOCAL_API_URL);
    }

    static getInstance(): AIService {
        if (!AIService.instance) 
            AIService.instance = new AIService();
        
        return AIService.instance;
    }

    async initialize() {
        // Fetch settings from backend API
        const [error, settings] = await attemptPromise(() => aiApi.getSettings());

        if (error) {
            logger.error("[AIService] Failed to fetch settings from API", error);
            throw error;
        }

        this.settings = settings;

        // Initialize providers with stored keys
        if (this.settings.openaiKey)
            this.providerFactory.initializeProvider("openai", this.settings.openaiKey);

        if (this.settings.openrouterKey)
            this.providerFactory.initializeProvider("openrouter", this.settings.openrouterKey);

        if (this.settings.geminiKey)
            this.providerFactory.initializeProvider("gemini", this.settings.geminiKey);

        if (this.settings.localApiUrl)
            this.providerFactory.updateLocalApiUrl(this.settings.localApiUrl);
        
    }

    async updateKey(provider: AIProvider, key: string) {
        if (!this.settings) throw new Error("AIService not initialized");

        logger.info(`[AIService] Updating key for provider: ${provider}`);

        const update: Partial<AISettings> = {
            ...(provider === "openai" && { openaiKey: key }),
            ...(provider === "openrouter" && { openrouterKey: key }),
            ...(provider === "gemini" && { geminiKey: key })
        };

        const result = aiSettingsSchema.partial().safeParse(update);
        if (!result.success) 
            throw new Error(`Invalid AI settings update data: ${result.error.message}`);
        

        // Update via API
        if (!this.settings) throw new Error("Settings not initialized");
        const settingsId = this.settings.id;
        const [error] = await attemptPromise(() => aiApi.updateSettings(settingsId, update));
        if (error) {
            logger.error("[AIService] Failed to update settings via API", error);
            throw error;
        }

        Object.assign(this.settings, update);

        // Initialize provider with new key
        this.providerFactory.initializeProvider(provider, key);

        // Fetch available models when key is updated
        await this.fetchAvailableModels(provider);
    }

    private async fetchAvailableModels(provider: AIProvider) {
        if (!this.settings) throw new Error("AIService not initialized");

        logger.info(`[AIService] Fetching available models for provider: ${provider}`);

        const aiProvider = this.providerFactory.getProvider(provider);
        const [error, models] = await attemptPromise(() => aiProvider.fetchModels());

        if (error) {
            logger.error("Error fetching models:", error);
            throw error;
        }

        logger.info(`[AIService] Fetched ${models.length} models for ${provider}`);

        // Update only models from this provider, keep others
        const existingModels = this.settings.availableModels.filter(m => m.provider !== provider);
        const updatedModels = [...existingModels, ...models];

        const updateData = {
            availableModels: updatedModels,
            lastModelsFetch: new Date()
        };

        const result = aiSettingsSchema.partial().safeParse(updateData);
        if (!result.success) 
            throw new Error(`Invalid AI settings update data: ${result.error.message}`);
        

        // Update via API
        if (!this.settings) throw new Error("Settings not initialized");
        const settingsId = this.settings.id;
        const [apiError] = await attemptPromise(() => aiApi.updateSettings(settingsId, updateData));
        if (apiError) {
            logger.error("[AIService] Failed to update models via API", apiError);
            throw apiError;
        }

        this.settings.availableModels = updatedModels;
        this.settings.lastModelsFetch = new Date();
    }

    async getAvailableModels(provider?: AIProvider, forceRefresh: boolean = true): Promise<AIModel[]> {
        if (!this.settings) throw new Error("AIService not initialized");

        // Refresh settings from API to ensure we have latest data
        const [error, freshSettings] = await attemptPromise(() => aiApi.getSettings());
        if (!error && freshSettings) 
            this.settings = freshSettings;
        

        // Check if we should fetch fresh models
        if (provider && forceRefresh) 
            await this.fetchAvailableModels(provider);
        

        const result = provider
            ? this.settings.availableModels.filter(m => m.provider === provider)
            : this.settings.availableModels;

        return result;
    }

    private formatStreamAsSSE(response: Response): Response {
        const responseStream = new ReadableStream({
            async start(controller) {
                if (!response.body) {
                    controller.close();
                    return;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                const [error] = await attemptPromise(async () => {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const content = decoder.decode(value, { stream: true });
                        const formattedChunk = formatSSEChunk(content);

                        controller.enqueue(new TextEncoder().encode(formattedChunk));
                    }
                    controller.enqueue(new TextEncoder().encode(formatSSEDone()));
                });

                if (error) 
                    if ((error as Error).name === "AbortError") 
                        controller.close();
                     else 
                        controller.error(error);
                    
                 else 
                    controller.close();
                
            }
        });

        return new Response(responseStream, {
            headers: { "Content-Type": "text/event-stream" }
        });
    }

    async generateWithLocalModel(
        messages: PromptMessage[],
        modelId: string,
        temperature: number = 1.0,
        maxTokens: number = 2048,
        _top_p?: number,
        _top_k?: number,
        _repetition_penalty?: number,
        _min_p?: number
    ): Promise<Response> {
        this.abortController = new AbortController();

        const provider = this.providerFactory.getProvider("local");
        return await provider.generate(messages, modelId, temperature, maxTokens, this.abortController.signal);
    }

    async generateWithOpenAI(
        messages: PromptMessage[],
        modelId: string,
        temperature: number = 1.0,
        maxTokens: number = 2048,
        _top_p?: number,
        _top_k?: number,
        _repetition_penalty?: number,
        _min_p?: number
    ): Promise<Response> {
        if (!this.settings?.openaiKey) 
            throw new Error("OpenAI API key not set");
        

        const provider = this.providerFactory.getProvider("openai");
        if (!provider.isInitialized()) 
            this.providerFactory.initializeProvider("openai", this.settings.openaiKey);
        

        return await this.generateWithSSEFormatting(provider, messages, modelId, temperature, maxTokens);
    }

    async generateWithOpenRouter(
        messages: PromptMessage[],
        modelId: string,
        temperature: number = 1.0,
        maxTokens: number = 2048,
        _top_p?: number,
        _top_k?: number,
        _repetition_penalty?: number,
        _min_p?: number
    ): Promise<Response> {
        if (!this.settings?.openrouterKey) 
            throw new Error("OpenRouter API key not set");
        

        const provider = this.providerFactory.getProvider("openrouter");
        if (!provider.isInitialized()) 
            this.providerFactory.initializeProvider("openrouter", this.settings.openrouterKey);
        

        return await this.generateWithSSEFormatting(provider, messages, modelId, temperature, maxTokens);
    }

    async generateWithGemini(
        messages: PromptMessage[],
        modelId: string,
        temperature: number = 1.0,
        maxTokens: number = 2048,
        _top_p?: number,
        _top_k?: number,
        _repetition_penalty?: number,
        _min_p?: number
    ): Promise<Response> {
        if (!this.settings?.geminiKey)
            throw new Error("Gemini API key not set");

        const provider = this.providerFactory.getProvider("gemini");
        if (!provider.isInitialized())
            this.providerFactory.initializeProvider("gemini", this.settings.geminiKey);

        return await this.generateWithSSEFormatting(provider, messages, modelId, temperature, maxTokens);
    }

    private async generateWithSSEFormatting(
        provider: IAIProvider,
        messages: PromptMessage[],
        modelId: string,
        temperature: number,
        maxTokens: number
    ): Promise<Response> {
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        const [error, response] = await attemptPromise(() =>
            provider.generate(messages, modelId, temperature, maxTokens, signal)
        );

        if (error) {
            if ((error as Error).name === "AbortError") 
                return new Response(null, { status: 204 });
            
            throw error;
        }

        if (!response) 
            throw new Error("No response from provider");
        

        return this.formatStreamAsSSE(response);
    }

    async processStreamedResponse(
        response: Response,
        onToken: (text: string) => void,
        onComplete: () => void,
        onError: (error: Error) => void
    ) {
        if (!response.body) 
            return onError(new Error("Response body is null"));
        

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        const [error] = await attemptPromise(async () => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    onComplete();
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n").filter(line => line.trim() !== "");

                for (const line of lines) 
                    if (line.startsWith("data: ")) {
                        const data = line.substring(6);
                        if (data === "[DONE]") {
                            onComplete();
                            return;
                        }
                        const [parseError, json] = await attemptPromise(() => Promise.resolve(JSON.parse(data)));
                        if (!parseError && json) {
                            const text = json.choices[0]?.delta?.content || "";
                            if (text) 
                                onToken(text);
                            
                        }
                    }
                
            }
        });

        if (error) 
            if ((error as Error).name === "AbortError") {
                logger.info("Stream reading aborted.");
                onComplete();
            } else 
                onError(error as Error);
            
        

        this.abortController = null;
    }

    // Getter methods
    getOpenAIKey(): string | undefined {
        return this.settings?.openaiKey;
    }

    getOpenRouterKey(): string | undefined {
        return this.settings?.openrouterKey;
    }

    getLocalApiUrl(): string {
        return this.settings?.localApiUrl || this.DEFAULT_LOCAL_API_URL;
    }

    getDefaultLocalModel(): string | undefined {
        return this.settings?.defaultLocalModel;
    }

    getDefaultOpenAIModel(): string | undefined {
        return this.settings?.defaultOpenAIModel;
    }

    getDefaultOpenRouterModel(): string | undefined {
        return this.settings?.defaultOpenRouterModel;
    }

    getGeminiKey(): string | undefined {
        return this.settings?.geminiKey;
    }

    getDefaultGeminiModel(): string | undefined {
        return this.settings?.defaultGeminiModel;
    }

    async updateDefaultModel(provider: AIProvider, modelId: string | undefined): Promise<void> {
        if (!this.settings) 
            throw new Error("AI settings not initialized");
        

        let updateData: Partial<AISettings>;
        if (provider === "local")
            updateData = { defaultLocalModel: modelId };
        else if (provider === "openai")
            updateData = { defaultOpenAIModel: modelId };
        else if (provider === "openrouter")
            updateData = { defaultOpenRouterModel: modelId };
        else if (provider === "gemini")
            updateData = { defaultGeminiModel: modelId };
        else
            return;
        

        const result = aiSettingsSchema.partial().safeParse(updateData);
        if (!result.success) 
            throw new Error(`Invalid AI settings update data: ${result.error.message}`);
        

        // Update via API
        const settingsId = this.settings.id;
        const [error] = await attemptPromise(() => aiApi.updateSettings(settingsId, updateData));
        if (error) {
            logger.error("[AIService] Failed to update default model via API", error);
            throw error;
        }

        Object.assign(this.settings, updateData);
    }

    async updateLocalApiUrl(url: string): Promise<void> {
        if (!this.settings) 
            throw new Error("Settings not initialized");
        

        const updateData = { localApiUrl: url };

        const result = aiSettingsSchema.partial().safeParse(updateData);
        if (!result.success) 
            throw new Error(`Invalid AI settings update data: ${result.error.message}`);
        

        // Update via API
        const settingsId2 = this.settings.id;
        const [error] = await attemptPromise(() => aiApi.updateSettings(settingsId2, updateData));
        if (error) {
            logger.error("[AIService] Failed to update local API URL via API", error);
            throw error;
        }

        this.settings.localApiUrl = url;

        // Update provider and re-fetch models
        this.providerFactory.updateLocalApiUrl(url);
        await this.fetchAvailableModels("local");
    }

    getSettings(): AISettings | null {
        return this.settings;
    }

    abortStream(): void {
        if (this.abortController) {
            logger.info("[AIService] Aborting stream");
            this.abortController.abort();
            this.abortController = null;
        }
    }
}

export const aiService = AIService.getInstance();
