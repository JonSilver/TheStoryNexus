import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { NodeKey } from "lexical";
import type { JSX } from "react";
import { useCallback, useEffect, useMemo } from "react";
import { PromptPreviewDialog } from "@/components/ui/prompt-preview-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useChapterQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useLorebookContext } from "@/features/lorebook/context/LorebookContext";
import { useChapterMatching } from "@/features/lorebook/hooks/useChapterMatching";
import { buildTagMap } from "@/features/lorebook/utils/lorebookFilters";
import { useLastUsedPrompt } from "@/features/prompts/hooks/useLastUsedPrompt";
import { usePromptsQuery } from "@/features/prompts/hooks/usePromptsQuery";
import { useDeleteSceneBeatMutation } from "@/features/scenebeats/hooks/useSceneBeatQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { SceneBeatMatchedEntries } from "../SceneBeatMatchedEntries";
import { ContextToggles } from "./components/ContextToggles";
import { GenerationControls } from "./components/GenerationControls";
import { LorebookMultiSelect } from "./components/LorebookMultiSelect";
import { MatchedEntriesPanel } from "./components/MatchedEntriesPanel";
import { SceneBeatHeader } from "./components/SceneBeatHeader";
import { useCommandHistory } from "./hooks/useCommandHistory";
import { useLorebookMatching } from "./hooks/useLorebookMatching";
import { useSceneBeatData } from "./hooks/useSceneBeatData";
import { useSceneBeatGeneration } from "./hooks/useSceneBeatGeneration";
import { useSceneBeatHandlers } from "./hooks/useSceneBeatHandlers";
import { useSceneBeatState } from "./hooks/useSceneBeatState";
import { useSceneBeatSync } from "./hooks/useSceneBeatSync";

export default function SceneBeatComponent({ nodeKey }: { nodeKey: NodeKey }): JSX.Element {
    const [editor] = useLexicalComposerContext();
    const { currentStoryId, currentChapterId } = useStoryContext();
    const { data: currentChapter } = useChapterQuery(currentChapterId || "");
    const { data: prompts = [], isLoading, error: promptsQueryError } = usePromptsQuery({ includeSystem: true });
    const promptsError = promptsQueryError?.message ?? null;
    const { lastUsed, saveSelection } = useLastUsedPrompt("scene_beat", prompts);
    const { entries } = useLorebookContext();
    const { chapterMatchedEntries } = useChapterMatching();

    const tagMap = useMemo(() => buildTagMap(entries), [entries]);
    const characterEntries = useMemo(() => entries.filter(entry => entry.category === "character"), [entries]);

    const {
        sceneBeatId,
        isLoaded,
        initialCommand,
        initialPovType,
        initialPovCharacter,
        useMatchedChapter: initialUseMatchedChapter,
        useMatchedSceneBeat: initialUseMatchedSceneBeat,
        useCustomContext: initialUseCustomContext,
        collapsed: initialCollapsed
    } = useSceneBeatData({
        editor,
        nodeKey,
        currentStoryId,
        currentChapterId,
        defaultPovType: currentChapter?.povType || "Third Person Omniscient",
        defaultPovCharacter: currentChapter?.povCharacter
    });

    const state = useSceneBeatState({
        initialCollapsed,
        initialUseMatchedChapter,
        initialUseMatchedSceneBeat,
        initialUseCustomContext,
        initialPovType,
        initialPovCharacter,
        lastUsedPrompt: lastUsed?.prompt,
        lastUsedModel: lastUsed?.model
    });

    useEffect(() => {
        if (lastUsed && !state.selectedPrompt) {
            state.setSelectedPrompt(lastUsed.prompt);
            state.setSelectedModel(lastUsed.model);
        }
    }, [lastUsed, state.selectedPrompt, state]);

    const { command, handleCommandChange: baseHandleCommandChange, handleKeyDown } = useCommandHistory(initialCommand);
    const localMatchedEntries = useLorebookMatching(command, tagMap);

    const { saveCommand, flushCommand, saveToggles, savePOVSettings, saveAccepted, saveCollapsed } =
        useSceneBeatSync(sceneBeatId);
    const deleteMutation = useDeleteSceneBeatMutation();

    const {
        streaming,
        streamedText,
        streamComplete,
        previewMessages,
        previewLoading,
        previewError,
        generateWithConfig,
        previewPrompt,
        stopGeneration,
        resetGeneration
    } = useSceneBeatGeneration();

    const handleCommandChange = useCallback(
        (newCommand: string) => {
            baseHandleCommandChange(newCommand);
            if (sceneBeatId && isLoaded) saveCommand(newCommand);
        },
        [baseHandleCommandChange, sceneBeatId, isLoaded, saveCommand]
    );

    const handlers = useSceneBeatHandlers({
        editor,
        nodeKey,
        sceneBeatId,
        isLoaded,
        currentStoryId,
        currentChapterId,
        command,
        povType: state.povType,
        povCharacter: state.povCharacter,
        useMatchedChapter: state.useMatchedChapter,
        useMatchedSceneBeat: state.useMatchedSceneBeat,
        useCustomContext: state.useCustomContext,
        selectedItems: state.selectedItems,
        chapterMatchedEntries,
        localMatchedEntries,
        selectedPrompt: state.selectedPrompt,
        selectedModel: state.selectedModel,
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
        setCollapsed: state.setCollapsed,
        setMatchedChapter: state.setMatchedChapter,
        setMatchedSceneBeat: state.setMatchedSceneBeat,
        setCustomContext: state.setCustomContext,
        setPov: state.setPov,
        setShowPreviewDialog: state.setShowPreviewDialog,
        setSelectedPrompt: state.setSelectedPrompt,
        setSelectedModel: state.setSelectedModel,
        saveSelection
    });

    const handleItemSelect = useCallback(
        (itemId: string) => {
            const item = entries.find(entry => entry.id === itemId);
            if (item) state.addSelectedItem(item);
        },
        [entries, state]
    );

    return (
        <div className="relative my-4 rounded-lg border border-border bg-card">
            <SceneBeatHeader
                collapsed={state.collapsed}
                streaming={streaming}
                povType={state.povType}
                povCharacter={state.povCharacter}
                characterEntries={characterEntries}
                onToggleCollapsed={() => handlers.handleToggleCollapsed(!state.collapsed)}
                onStopGeneration={stopGeneration}
                onToggleMatchedEntries={() => state.setShowMatchedEntries(!state.showMatchedEntries)}
                onDelete={handlers.handleDelete}
                onPovSave={handlers.handlePovSave}
            />

            {isLoaded && !state.collapsed && (
                <div className="space-y-4">
                    <div className="p-4">
                        <Textarea
                            placeholder="Enter your scene beat command here..."
                            value={command}
                            onChange={e => handleCommandChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onClick={e => e.stopPropagation()}
                            className="min-h-[100px] resize-none"
                        />
                    </div>

                    <ContextToggles
                        useMatchedChapter={state.useMatchedChapter}
                        useMatchedSceneBeat={state.useMatchedSceneBeat}
                        useCustomContext={state.useCustomContext}
                        onMatchedChapterChange={handlers.handleMatchedChapterChange}
                        onMatchedSceneBeatChange={handlers.handleMatchedSceneBeatChange}
                        onCustomContextChange={handlers.handleCustomContextChange}
                    >
                        {state.useCustomContext && (
                            <LorebookMultiSelect
                                entries={entries}
                                selectedItems={state.selectedItems}
                                onItemSelect={handleItemSelect}
                                onItemRemove={state.removeSelectedItem}
                            />
                        )}
                    </ContextToggles>

                    {streamedText && <div className="border-t border-border p-2">{streamedText}</div>}

                    <GenerationControls
                        isLoading={isLoading}
                        error={promptsError}
                        prompts={prompts}
                        selectedPrompt={state.selectedPrompt}
                        selectedModel={state.selectedModel}
                        streaming={streaming}
                        streamComplete={streamComplete}
                        onPromptSelect={handlers.handlePromptSelect}
                        onPreview={handlers.handlePreviewPrompt}
                        onGenerate={handlers.handleGenerateWithPrompt}
                        onAccept={handlers.handleAccept}
                        onReject={handlers.handleReject}
                        lastUsed={lastUsed}
                    />
                </div>
            )}

            <SceneBeatMatchedEntries
                open={state.showMatchedEntries}
                onOpenChange={state.setShowMatchedEntries}
                matchedEntries={new Set(localMatchedEntries.values())}
            />

            <PromptPreviewDialog
                open={state.showPreviewDialog}
                onOpenChange={state.setShowPreviewDialog}
                messages={previewMessages}
                isLoading={previewLoading}
                error={previewError}
            />

            {state.showMatchedEntries && (
                <MatchedEntriesPanel
                    chapterMatchedEntries={chapterMatchedEntries}
                    sceneBeatMatchedEntries={localMatchedEntries}
                    customContextEntries={state.selectedItems}
                    useMatchedChapter={state.useMatchedChapter}
                    useMatchedSceneBeat={state.useMatchedSceneBeat}
                    useCustomContext={state.useCustomContext}
                />
            )}
        </div>
    );
}
