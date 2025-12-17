import { attemptPromise } from "@jfdi/attempt";
import { type RefObject, useCallback, useRef, useState } from "react";
import { toast } from "react-toastify";
import { aiService } from "@/services/ai/AIService";
import type { AIChat, ChatMessage } from "@/types/story";
import { logger } from "@/utils/logger";
import { useUpdateBrainstormMutation } from "./useBrainstormQuery";

interface UseMessageEditingParams {
    selectedChat: AIChat;
    streamingMessageId: string | null;
    onChatUpdate: (chat: AIChat) => void;
}

interface UseMessageEditingReturn {
    editingMessageId: string | null;
    editingContent: string;
    editingTextareaRef: RefObject<HTMLTextAreaElement | null>;
    startEdit: (message: ChatMessage) => void;
    saveEdit: (messageId: string) => Promise<void>;
    cancelEdit: () => void;
    setEditingContent: (content: string) => void;
}

export const useMessageEditing = ({
    selectedChat,
    streamingMessageId,
    onChatUpdate
}: UseMessageEditingParams): UseMessageEditingReturn => {
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState("");
    const editingTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    const updateMutation = useUpdateBrainstormMutation();

    const startEdit = useCallback(
        (message: ChatMessage) => {
            if (streamingMessageId === message.id) {
                if (!confirm("This message is still being generated. Stop generation and edit?")) return;

                aiService.abortStream();
            }
            setEditingMessageId(message.id);
            setEditingContent(message.content);
        },
        [streamingMessageId]
    );

    const saveEdit = useCallback(
        async (messageId: string) => {
            if (!editingContent.trim()) {
                toast.error("Edited content cannot be empty");
                return;
            }

            const [error] = await attemptPromise(async () => {
                const existingMsg = selectedChat.messages?.find(m => m.id === messageId);
                if (!existingMsg) throw new Error("Message not found");

                const originalContent = existingMsg.originalContent ?? existingMsg.content;
                const editedAt = new Date().toISOString();

                const updatedMessages = selectedChat.messages?.map(msg =>
                    msg.id === messageId
                        ? {
                              ...msg,
                              content: editingContent,
                              originalContent,
                              editedAt,
                              editedBy: "user" as const
                          }
                        : msg
                );

                await new Promise<void>((resolve, reject) => {
                    updateMutation.mutate(
                        {
                            id: selectedChat.id,
                            data: { messages: updatedMessages }
                        },
                        {
                            onSuccess: updatedChat => {
                                onChatUpdate(updatedChat);
                                resolve();
                            },
                            onError: reject
                        }
                    );
                });
            });

            if (error) {
                logger.error("Failed to save edit", error);
                toast.error("Failed to save edit");
                return;
            }

            toast.success("Message edited");
            setEditingMessageId(null);
            setEditingContent("");
        },
        [editingContent, selectedChat, updateMutation, onChatUpdate]
    );

    const cancelEdit = useCallback(() => {
        setEditingMessageId(null);
        setEditingContent("");
    }, []);

    return {
        editingMessageId,
        editingContent,
        editingTextareaRef,
        startEdit,
        saveEdit,
        cancelEdit,
        setEditingContent
    };
};
