import type { LexicalEditor, NodeKey } from "lexical";
import { useCallback } from "react";
import { toast } from "react-toastify";
import type { AllowedModel, LorebookEntry, Prompt } from "@/types/story";
import { logger } from "@/utils/logger";
import type { POVType } from "../components/POVSettingsPopover";
import { insertTextAfterNode } from "../services/lexicalEditorUtils";
import { createPromptConfig } from "../services/sceneBeatPromptService";

interface UseSceneBeatHandlersProps {
    editor: LexicalEditor;
    nodeKey: NodeKey;
    sceneBeatId: string | undefined;
    isLoaded: boolean;
    currentStoryId: string | null | undefined;
    currentChapterId: string | null | undefined;
    command: string;
    povType: POVType | undefined;
    povCharacter: string | undefined;
    useMatchedChapter: boolean;
    useMatchedSceneBeat: boolean;
    useCustomContext: boolean;
    selectedItems: LorebookEntry[];
    chapterMatchedEntries: Map<string, LorebookEntry>;
    localMatchedEntries: Map<string, LorebookEntry>;
    selectedPrompt: Prompt | undefined;
    selectedModel: AllowedModel | undefined;
    streamedText: string;

    // Sync functions
    flushCommand: () => void;
    saveToggles: (chapter: boolean, sceneBeat: boolean, custom: boolean) => void;
    savePOVSettings: (povType: POVType | undefined, povCharacter: string | undefined) => void;
    saveAccepted: (accepted: boolean) => void;
    saveCollapsed: (collapsed: boolean) => void;
    deleteMutation: {
        mutate: (args: { id: string; chapterId: string }, opts?: { onError?: (err: Error) => void }) => void;
    };

    // Generation functions
    generateWithConfig: (
        config: ReturnType<typeof createPromptConfig>,
        model: AllowedModel | undefined
    ) => Promise<void>;
    previewPrompt: (config: ReturnType<typeof createPromptConfig>) => Promise<void>;
    resetGeneration: () => void;

    // State setters
    setCollapsed: (value: boolean) => void;
    setMatchedChapter: (value: boolean) => void;
    setMatchedSceneBeat: (value: boolean) => void;
    setCustomContext: (value: boolean) => void;
    setPov: (povType: POVType | undefined, povCharacter: string | undefined) => void;
    setShowPreviewDialog: (value: boolean) => void;
    setSelectedPrompt: (prompt: Prompt | undefined) => void;
    setSelectedModel: (model: AllowedModel | undefined) => void;
    saveSelection: (prompt: Prompt, model: AllowedModel) => void;
}

export const useSceneBeatHandlers = ({
    editor,
    nodeKey,
    sceneBeatId,
    isLoaded,
    currentStoryId,
    currentChapterId,
    command,
    povType,
    povCharacter,
    useMatchedChapter,
    useMatchedSceneBeat,
    useCustomContext,
    selectedItems,
    chapterMatchedEntries,
    localMatchedEntries,
    selectedPrompt,
    selectedModel,
    streamedText,
    flushCommand,
    saveToggles,
    savePOVSettings,
    saveAccepted,
    saveCollapsed,
    deleteMutation,
    generateWithConfig,
    previewPrompt,
    resetGeneration,
    setCollapsed,
    setMatchedChapter,
    setMatchedSceneBeat,
    setCustomContext,
    setPov,
    setShowPreviewDialog,
    setSelectedPrompt,
    setSelectedModel,
    saveSelection
}: UseSceneBeatHandlersProps) => {
    const handleDelete = useCallback(() => {
        flushCommand();

        if (sceneBeatId && currentChapterId)
            deleteMutation.mutate(
                { id: sceneBeatId, chapterId: currentChapterId },
                {
                    onError: err => {
                        logger.error("Error deleting SceneBeat from database:", err);
                        toast.error("Failed to delete scene beat from database");
                    }
                }
            );

        editor.update(() => {
            const node = editor.getEditorState().read(() => editor._editorState._nodeMap.get(nodeKey));
            if (node) node.remove();
        });
    }, [editor, nodeKey, sceneBeatId, currentChapterId, flushCommand, deleteMutation]);

    const handleToggleCollapsed = useCallback(
        (newCollapsed: boolean) => {
            setCollapsed(newCollapsed);
            if (sceneBeatId && isLoaded) saveCollapsed(newCollapsed);
        },
        [sceneBeatId, isLoaded, setCollapsed, saveCollapsed]
    );

    const handleMatchedChapterChange = useCallback(
        (value: boolean) => {
            setMatchedChapter(value);
            if (sceneBeatId && isLoaded) saveToggles(value, useMatchedSceneBeat, useCustomContext);
        },
        [sceneBeatId, isLoaded, setMatchedChapter, saveToggles, useMatchedSceneBeat, useCustomContext]
    );

    const handleMatchedSceneBeatChange = useCallback(
        (value: boolean) => {
            setMatchedSceneBeat(value);
            if (sceneBeatId && isLoaded) saveToggles(useMatchedChapter, value, useCustomContext);
        },
        [sceneBeatId, isLoaded, setMatchedSceneBeat, saveToggles, useMatchedChapter, useCustomContext]
    );

    const handleCustomContextChange = useCallback(
        (value: boolean) => {
            setCustomContext(value);
            if (sceneBeatId && isLoaded) saveToggles(useMatchedChapter, useMatchedSceneBeat, value);
        },
        [sceneBeatId, isLoaded, setCustomContext, saveToggles, useMatchedChapter, useMatchedSceneBeat]
    );

    const handlePovSave = useCallback(
        async (newPovType: POVType | undefined, newPovCharacter: string | undefined) => {
            setPov(newPovType, newPovCharacter);
            savePOVSettings(newPovType, newPovCharacter);
            toast.success("POV settings saved");
        },
        [setPov, savePOVSettings]
    );

    const handlePromptSelect = useCallback(
        (prompt: Prompt, model: AllowedModel) => {
            setSelectedPrompt(prompt);
            setSelectedModel(model);
            saveSelection(prompt, model);
        },
        [setSelectedPrompt, setSelectedModel, saveSelection]
    );

    const createConfig = useCallback(() => {
        if (!selectedPrompt || !currentStoryId || !currentChapterId) return null;
        return createPromptConfig(editor, nodeKey, selectedPrompt, {
            storyId: currentStoryId,
            chapterId: currentChapterId,
                command,
                povType,
                povCharacter,
                chapterMatchedEntries,
                localMatchedEntries,
                sceneBeatContext: {
                    useMatchedChapter,
                    useMatchedSceneBeat,
                    useCustomContext,
                    customContextItems: selectedItems.map(item => item.id)
                },
                selectedItems
            });
        },
        [
            editor,
            nodeKey,
            selectedPrompt,
            currentStoryId,
            currentChapterId,
            command,
            povType,
            povCharacter,
            chapterMatchedEntries,
            localMatchedEntries,
            useMatchedChapter,
            useMatchedSceneBeat,
            useCustomContext,
            selectedItems
        ]
    );

    const handlePreviewPrompt = useCallback(async () => {
        const config = createConfig();
        if (!config) {
            toast.error("Please select a prompt first");
            return;
        }
        await previewPrompt(config);
        setShowPreviewDialog(true);
    }, [previewPrompt, createConfig, setShowPreviewDialog]);

    const handleGenerateWithPrompt = useCallback(async () => {
        const config = createConfig();
        if (!config) {
            toast.error("Please select a prompt first");
            return;
        }
        await generateWithConfig(config, selectedModel);
    }, [generateWithConfig, createConfig, selectedModel]);

    const handleAccept = useCallback(() => {
        flushCommand();
        insertTextAfterNode(editor, nodeKey, streamedText);
        saveAccepted(true);
        resetGeneration();
    }, [editor, nodeKey, streamedText, flushCommand, saveAccepted, resetGeneration]);

    const handleReject = useCallback(() => {
        resetGeneration();
    }, [resetGeneration]);

    return {
        handleDelete,
        handleToggleCollapsed,
        handleMatchedChapterChange,
        handleMatchedSceneBeatChange,
        handleCustomContextChange,
        handlePovSave,
        handlePromptSelect,
        handlePreviewPrompt,
        handleGenerateWithPrompt,
        handleAccept,
        handleReject
    };
};
