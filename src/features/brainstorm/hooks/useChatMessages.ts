import { useMemo } from "react";
import type { AIChat, ChatMessage } from "@/types/story";

interface UseChatMessagesParams {
    selectedChat: AIChat;
    streamingMessageId: string | null;
    streamingContent: string;
    pendingUserMessage: ChatMessage | null;
}

export const useChatMessages = ({
    selectedChat,
    streamingMessageId,
    streamingContent,
    pendingUserMessage
}: UseChatMessagesParams): ChatMessage[] =>
    useMemo(() => {
        const baseMessages = selectedChat.messages;
        const messagesToAdd: ChatMessage[] = [];

        if (pendingUserMessage) {
            messagesToAdd.push(pendingUserMessage);
        }

        if (streamingMessageId) {
            messagesToAdd.push({
                id: streamingMessageId,
                content: streamingContent,
                role: "assistant",
                timestamp: new Date()
            });
        }

        return messagesToAdd.length > 0 ? [...baseMessages, ...messagesToAdd] : baseMessages;
    }, [selectedChat.messages, streamingMessageId, streamingContent, pendingUserMessage]);
