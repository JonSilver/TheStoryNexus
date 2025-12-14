import { useState, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { attemptPromise } from "@jfdi/attempt";
import { logger } from "@/utils/logger";
import { randomUUID } from "@/utils/crypto";
import { useGenerateWithPrompt } from "@/features/ai/hooks/useGenerateWithPrompt";
import { useStreamingGeneration } from "@/features/ai/hooks/useStreamingGeneration";
import { useCreateBrainstormMutation, useUpdateBrainstormMutation } from "./useBrainstormQuery";
import type { AIChat, AllowedModel, ChatMessage, Prompt, PromptParserConfig } from "@/types/story";

interface UseMessageGenerationParams {
    selectedChat: AIChat;
    selectedPrompt: Prompt | null;
    selectedModel: AllowedModel | null;
    storyId: string;
    onChatUpdate: (chat: AIChat) => void;
    createPromptConfig: (prompt: Prompt) => PromptParserConfig;
}

interface UseMessageGenerationReturn {
    generate: (input: string) => Promise<void>;
    isGenerating: boolean;
    abort: () => void;
    streamingMessageId: string | null;
    streamingContent: string;
    pendingUserMessage: ChatMessage | null;
}

export const useMessageGeneration = ({
    selectedChat,
    selectedPrompt,
    selectedModel,
    storyId,
    onChatUpdate,
    createPromptConfig
}: UseMessageGenerationParams): UseMessageGenerationReturn => {
    const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
    const [pendingUserMessage, setPendingUserMessage] = useState<ChatMessage | null>(null);

    const { generateWithPrompt } = useGenerateWithPrompt();
    const { isStreaming, streamedText, processStream, abort: abortStream, reset } = useStreamingGeneration();
    const createMutation = useCreateBrainstormMutation();
    const updateMutation = useUpdateBrainstormMutation();

    const generationContextRef = useRef<{
        userMessage: ChatMessage;
        assistantMessageId: string;
        chatId: string;
    } | null>(null);

    const abort = useCallback(() => {
        abortStream();
        setStreamingMessageId(null);
        setPendingUserMessage(null);
        generationContextRef.current = null;
    }, [abortStream]);

    const generate = useCallback(
        async (input: string) => {
            if (!input.trim() || !selectedPrompt || !selectedModel || isStreaming) return;

            const [error] = await attemptPromise(async () => {
                const userMessage: ChatMessage = {
                    id: randomUUID(),
                    role: "user",
                    content: input.trim(),
                    timestamp: new Date()
                };

                setPendingUserMessage(userMessage);

                const chatIdToUse =
                    selectedChat.id ||
                    (await new Promise<string>(resolve => {
                        const newTitle =
                            userMessage.content.substring(0, 40) + (userMessage.content.length > 40 ? "..." : "");

                        const newChat = {
                            id: randomUUID(),
                            storyId,
                            title: newTitle,
                            messages: [userMessage],
                            updatedAt: new Date()
                        };

                        createMutation.mutate(newChat, {
                            onSuccess: created => {
                                onChatUpdate(created);
                                resolve(created.id);
                            }
                        });
                    }));

                const config = createPromptConfig(selectedPrompt);
                const response = await generateWithPrompt(config, selectedModel);

                if (response.status === 204) {
                    logger.info("Generation was aborted.");
                    reset();
                    return;
                }

                const assistantMessageId = randomUUID();
                setStreamingMessageId(assistantMessageId);

                generationContextRef.current = {
                    userMessage,
                    assistantMessageId,
                    chatId: chatIdToUse
                };

                const fullResponse = await processStream(response);

                const ctx = generationContextRef.current;
                if (ctx && fullResponse) {
                    const assistantMessage: ChatMessage = {
                        id: ctx.assistantMessageId,
                        role: "assistant",
                        content: fullResponse,
                        timestamp: new Date()
                    };

                    const updatedMessages = [...selectedChat.messages, ctx.userMessage, assistantMessage];

                    updateMutation.mutate(
                        {
                            id: ctx.chatId,
                            data: { messages: updatedMessages }
                        },
                        {
                            onSuccess: updatedChat => {
                                onChatUpdate(updatedChat);
                            }
                        }
                    );
                }

                setStreamingMessageId(null);
                setPendingUserMessage(null);
                generationContextRef.current = null;
            });

            if (error) {
                logger.error("Error during generation:", error);
                toast.error("An error occurred during generation");
                setStreamingMessageId(null);
                setPendingUserMessage(null);
                generationContextRef.current = null;
            }
        },
        [
            selectedChat,
            selectedPrompt,
            selectedModel,
            isStreaming,
            storyId,
            createPromptConfig,
            generateWithPrompt,
            processStream,
            reset,
            createMutation,
            updateMutation,
            onChatUpdate
        ]
    );

    return {
        generate,
        isGenerating: isStreaming,
        abort,
        streamingMessageId,
        streamingContent: streamedText,
        pendingUserMessage
    };
};
