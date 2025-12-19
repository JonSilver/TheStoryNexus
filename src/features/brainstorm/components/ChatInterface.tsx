import { useCallback, useEffect, useState } from "react";
import { useAvailableModels } from "@/features/ai/hooks/useAvailableModels";
import { useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useLorebookContext } from "@/features/lorebook/context/LorebookContext";
import { getFilteredEntries as getFilteredLorebookEntries } from "@/features/lorebook/utils/lorebookFilters";
import { usePromptsQuery } from "@/features/prompts/hooks/usePromptsQuery";
import type { AIChat, AllowedModel, Prompt, PromptParserConfig } from "@/types/story";
import { useChatMessages } from "../hooks/useChatMessages";
import { useContextSelection } from "../hooks/useContextSelection";
import { useMessageEditing } from "../hooks/useMessageEditing";
import { useMessageGeneration } from "../hooks/useMessageGeneration";
import { usePromptPreview } from "../hooks/usePromptPreview";
import { usePromptSelection } from "../hooks/usePromptSelection";
import { ChatMessageList } from "./ChatMessageList";
import { ContextSelector } from "./ContextSelector";
import { MessageInputArea } from "./MessageInputArea";
import { PromptControls } from "./PromptControls";

interface ChatInterfaceProps {
    storyId: string;
    selectedChat: AIChat;
    onChatUpdate: (chat: AIChat) => void;
}

export default function ChatInterface({ storyId, selectedChat, onChatUpdate }: ChatInterfaceProps) {
    const [input, setInput] = useState("");

    const { entries: lorebookEntries } = useLorebookContext();
    const {
        data: prompts = [],
        isLoading: promptsLoading,
        error: promptsQueryError
    } = usePromptsQuery({ includeSystem: true });
    const { data: chapters = [] } = useChaptersByStoryQuery(storyId);
    const promptsError = promptsQueryError?.message ?? null;

    const { data: availableModels = [] } = useAvailableModels();

    const { selectedPrompt, selectedModel, selectPrompt } = usePromptSelection(
        selectedChat.id,
        selectedChat.lastUsedPromptId,
        selectedChat.lastUsedModelId,
        prompts
    );

    const { showPreview, previewMessages, previewLoading, previewError, openPreview, closePreview } =
        usePromptPreview();

    const {
        includeFullContext,
        contextOpen,
        selectedSummaries,
        selectedItems,
        selectedChapterContent,
        toggleFullContext,
        toggleContextOpen,
        toggleSummary,
        addItem,
        removeItem,
        addChapterContent,
        removeChapterContent,
        clearSelections
    } = useContextSelection();

    const createPromptConfig = useCallback(
        (prompt: Prompt): PromptParserConfig => ({
            promptId: prompt.id,
            storyId,
            scenebeat: input.trim(),
            additionalContext: {
                chatHistory: selectedChat.messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                includeFullContext,
                selectedSummaries: includeFullContext ? [] : selectedSummaries,
                selectedItems: includeFullContext ? [] : selectedItems.map(item => item.id),
                selectedChapterContent: includeFullContext ? [] : selectedChapterContent
            }
        }),
        [
            input,
            storyId,
            selectedChat.messages,
            includeFullContext,
            selectedSummaries,
            selectedItems,
            selectedChapterContent
        ]
    );

    const { generate, isGenerating, abort, streamingMessageId, streamingContent, pendingUserMessage } =
        useMessageGeneration({
            selectedChat,
            selectedPrompt,
            selectedModel,
            storyId,
            onChatUpdate,
            createPromptConfig
        });

    const { editingMessageId, editingContent, editingTextareaRef, startEdit, saveEdit, cancelEdit, setEditingContent } =
        useMessageEditing({
            selectedChat,
            streamingMessageId,
            onChatUpdate
        });

    const displayMessages = useChatMessages({
        selectedChat,
        streamingMessageId,
        streamingContent,
        pendingUserMessage
    });

    useEffect(() => {
        clearSelections();
    }, [clearSelections]);

    const getFilteredEntries = () => getFilteredLorebookEntries(lorebookEntries, false);

    const handlePromptSelect = (prompt: Prompt, model: AllowedModel) => {
        selectPrompt(prompt, model);
    };

    const handlePreviewPrompt = async () => {
        if (!selectedPrompt) return;
        const config = createPromptConfig(selectedPrompt);
        await openPreview(config);
    };

    const handleSubmit = async () => {
        await generate(input);
        setInput("");
    };

    const handleItemSelect = (itemId: string) => {
        const filteredEntries = getFilteredLorebookEntries(lorebookEntries, false);
        const item = filteredEntries.find(entry => entry.id === itemId);
        if (item) addItem(item);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 space-y-4">
                <PromptControls
                    prompts={prompts}
                    promptsLoading={promptsLoading}
                    promptsError={promptsError}
                    selectedPrompt={selectedPrompt}
                    selectedModel={selectedModel}
                    availableModels={availableModels.map(model => ({
                        id: model.id,
                        name: model.name,
                        provider: model.provider
                    }))}
                    showPreview={showPreview}
                    previewMessages={previewMessages}
                    previewLoading={previewLoading}
                    previewError={previewError}
                    onPromptSelect={handlePromptSelect}
                    onPreviewPrompt={handlePreviewPrompt}
                    onClosePreview={closePreview}
                />

                <ContextSelector
                    includeFullContext={includeFullContext}
                    contextOpen={contextOpen}
                    selectedSummaries={selectedSummaries}
                    selectedItems={selectedItems}
                    selectedChapterContent={selectedChapterContent}
                    chapters={chapters}
                    lorebookEntries={lorebookEntries}
                    onToggleFullContext={toggleFullContext}
                    onToggleContextOpen={toggleContextOpen}
                    onToggleSummary={toggleSummary}
                    onItemSelect={handleItemSelect}
                    onRemoveItem={removeItem}
                    onChapterContentSelect={addChapterContent}
                    onRemoveChapterContent={removeChapterContent}
                    getFilteredEntries={getFilteredEntries}
                />
            </div>

            <ChatMessageList
                messages={displayMessages}
                editingMessageId={editingMessageId}
                editingContent={editingContent}
                streamingMessageId={streamingMessageId}
                onStartEdit={startEdit}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
                onEditContentChange={setEditingContent}
                editingTextareaRef={editingTextareaRef}
            />

            <MessageInputArea
                input={input}
                isGenerating={isGenerating}
                selectedPrompt={selectedPrompt}
                onInputChange={setInput}
                onSend={handleSubmit}
                onStop={abort}
            />
        </div>
    );
}
