import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { LexicalNode, NodeKey, SerializedLexicalNode, Spread } from "lexical";
import { $applyNodeReplacement, DecoratorNode } from "lexical";
import { ChevronRight, Eye, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { AllowedModel, LorebookEntry, Prompt } from "@/types/story";
// Extracted services
import { logger } from "@/utils/logger";
import { SceneBeatMatchedEntries } from "./SceneBeatMatchedEntries";
// Extracted components
import { ContextToggles } from "./scene-beat/components/ContextToggles";
import { GenerationControls } from "./scene-beat/components/GenerationControls";
import { LorebookMultiSelect } from "./scene-beat/components/LorebookMultiSelect";
import { MatchedEntriesPanel } from "./scene-beat/components/MatchedEntriesPanel";
import type { POVType } from "./scene-beat/components/POVSettingsPopover";
import { POVSettingsPopover } from "./scene-beat/components/POVSettingsPopover";
// Extracted hooks
import { useCommandHistory } from "./scene-beat/hooks/useCommandHistory";
import { useLorebookMatching } from "./scene-beat/hooks/useLorebookMatching";
import { useSceneBeatData } from "./scene-beat/hooks/useSceneBeatData";
import { useSceneBeatGeneration } from "./scene-beat/hooks/useSceneBeatGeneration";
import { useSceneBeatSync } from "./scene-beat/hooks/useSceneBeatSync";
import { insertTextAfterNode } from "./scene-beat/services/lexicalEditorUtils";
import { createPromptConfig } from "./scene-beat/services/sceneBeatPromptService";

export type SerializedSceneBeatNode = Spread<
    {
        type: "scene-beat";
        version: 1;
        sceneBeatId: string;
    },
    SerializedLexicalNode
>;

function SceneBeatComponent({ nodeKey }: { nodeKey: NodeKey }): JSX.Element {
    const [editor] = useLexicalComposerContext();
    const { currentStoryId, currentChapterId } = useStoryContext();
    const { data: currentChapter } = useChapterQuery(currentChapterId || "");
    const { data: prompts = [], isLoading, error: promptsQueryError } = usePromptsQuery({ includeSystem: true });
    const promptsError = promptsQueryError?.message ?? null;
    const { lastUsed, saveSelection } = useLastUsedPrompt("scene_beat", prompts);
    const { entries } = useLorebookContext();
    const { chapterMatchedEntries } = useChapterMatching();

    const tagMap = useMemo(() => buildTagMap(entries), [entries]);

    // UI state - collapsed uses local state only after user interaction
    const [localCollapsed, setLocalCollapsed] = useState<boolean | null>(null);
    const hasEditedCollapsedRef = useRef(false);
    const [showMatchedEntries, setShowMatchedEntries] = useState(false);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | undefined>(lastUsed?.prompt);
    const [selectedModel, setSelectedModel] = useState<AllowedModel | undefined>(lastUsed?.model);
    const [selectedItems, setSelectedItems] = useState<LorebookEntry[]>([]);

    // Pre-populate from lastUsed when it becomes available
    useEffect(() => {
        if (lastUsed && !selectedPrompt) {
            setSelectedPrompt(lastUsed.prompt);
            setSelectedModel(lastUsed.model);
        }
    }, [lastUsed, selectedPrompt]);

    // Load scene beat data and initialize
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

    // Derive collapsed: use local state after user interaction, otherwise use DB value
    const collapsed = hasEditedCollapsedRef.current ? (localCollapsed ?? false) : initialCollapsed;

    // Track local edits - once user edits, we use local state; before that, use query data
    const hasEditedTogglesRef = useRef(false);
    const hasEditedPovRef = useRef(false);

    // Context toggles - local state for edits, but initialise from query
    const [localMatchedChapter, setLocalMatchedChapter] = useState<boolean | null>(null);
    const [localMatchedSceneBeat, setLocalMatchedSceneBeat] = useState<boolean | null>(null);
    const [localCustomContext, setLocalCustomContext] = useState<boolean | null>(null);

    // POV state - local state for edits, but initialise from query
    const [localPovType, setLocalPovType] = useState<POVType | undefined>(undefined);
    const [localPovCharacter, setLocalPovCharacter] = useState<string | undefined>(undefined);

    // Derive actual values: use local if edited, otherwise query data
    const useMatchedChapter = hasEditedTogglesRef.current ? (localMatchedChapter ?? true) : initialUseMatchedChapter;
    const useMatchedSceneBeat = hasEditedTogglesRef.current
        ? (localMatchedSceneBeat ?? false)
        : initialUseMatchedSceneBeat;
    const useCustomContext = hasEditedTogglesRef.current ? (localCustomContext ?? false) : initialUseCustomContext;
    const povType = hasEditedPovRef.current ? localPovType : initialPovType;
    const povCharacter = hasEditedPovRef.current ? localPovCharacter : initialPovCharacter;

    // Command history hook
    const { command, handleCommandChange: baseHandleCommandChange, handleKeyDown } = useCommandHistory(initialCommand);

    // Lorebook matching (derived state using useMemo)
    const localMatchedEntries = useLorebookMatching(command, tagMap);

    // Database sync hooks
    const { saveCommand, flushCommand, saveToggles, savePOVSettings, saveAccepted, saveCollapsed } =
        useSceneBeatSync(sceneBeatId);
    const deleteMutation = useDeleteSceneBeatMutation();

    // AI generation hook
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

    // Character entries (memoized for performance)
    const characterEntries = useMemo(() => entries.filter(entry => entry.category === "character"), [entries]);

    // Wrap command change handler to also save
    const handleCommandChange = useCallback(
        (newCommand: string) => {
            baseHandleCommandChange(newCommand);
            if (sceneBeatId && isLoaded) {
                saveCommand(newCommand);
            }
        },
        [baseHandleCommandChange, sceneBeatId, isLoaded, saveCommand]
    );

    // Wrap toggle handlers to set local state and save
    const handleMatchedChapterChange = useCallback(
        (value: boolean) => {
            hasEditedTogglesRef.current = true;
            setLocalMatchedChapter(value);
            if (sceneBeatId && isLoaded) saveToggles(value, useMatchedSceneBeat, useCustomContext);
        },
        [sceneBeatId, isLoaded, saveToggles, useMatchedSceneBeat, useCustomContext]
    );

    const handleMatchedSceneBeatChange = useCallback(
        (value: boolean) => {
            hasEditedTogglesRef.current = true;
            setLocalMatchedSceneBeat(value);
            if (sceneBeatId && isLoaded) saveToggles(useMatchedChapter, value, useCustomContext);
        },
        [sceneBeatId, isLoaded, saveToggles, useMatchedChapter, useCustomContext]
    );

    const handleCustomContextChange = useCallback(
        (value: boolean) => {
            hasEditedTogglesRef.current = true;
            setLocalCustomContext(value);
            if (sceneBeatId && isLoaded) saveToggles(useMatchedChapter, useMatchedSceneBeat, value);
        },
        [sceneBeatId, isLoaded, saveToggles, useMatchedChapter, useMatchedSceneBeat]
    );

    // Event handlers
    const handleDelete = () => {
        flushCommand();

        if (sceneBeatId && currentChapterId) {
            deleteMutation.mutate(
                { id: sceneBeatId, chapterId: currentChapterId },
                {
                    onError: err => {
                        logger.error("Error deleting SceneBeat from database:", err);
                        toast.error("Failed to delete scene beat from database");
                    }
                }
            );
        }

        editor.update(() => {
            const node = editor.getEditorState().read(() => editor._editorState._nodeMap.get(nodeKey));
            if (node) node.remove();
        });
    };

    const handlePromptSelect = (prompt: Prompt, model: AllowedModel) => {
        setSelectedPrompt(prompt);
        setSelectedModel(model);
        saveSelection(prompt, model);
    };

    const handlePovSave = async (newPovType: POVType | undefined, newPovCharacter: string | undefined) => {
        hasEditedPovRef.current = true;
        setLocalPovType(newPovType);
        setLocalPovCharacter(newPovCharacter);
        await savePOVSettings(newPovType, newPovCharacter);
        toast.success("POV settings saved");
    };

    const handlePreviewPrompt = async () => {
        if (!selectedPrompt || !currentStoryId || !currentChapterId) {
            toast.error("Please select a prompt first");
            return;
        }

        const config = createPromptConfig(editor, nodeKey, selectedPrompt, {
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

        await previewPrompt(config);
        setShowPreviewDialog(true);
    };

    const handleGenerateWithPrompt = async () => {
        if (!selectedPrompt || !currentStoryId || !currentChapterId) {
            toast.error("Please select a prompt first");
            return;
        }

        const config = createPromptConfig(editor, nodeKey, selectedPrompt, {
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

        await generateWithConfig(config, selectedModel);
    };

    const handleAccept = async () => {
        flushCommand();
        insertTextAfterNode(editor, nodeKey, streamedText);
        await saveAccepted(true);
        resetGeneration();
    };

    const handleReject = () => {
        resetGeneration();
    };

    const handleItemSelect = (itemId: string) => {
        const item = entries.find(entry => entry.id === itemId);
        if (item && !selectedItems.some(i => i.id === itemId)) setSelectedItems([...selectedItems, item]);
    };

    const removeItem = (itemId: string) => {
        setSelectedItems(selectedItems.filter(item => item.id !== itemId));
    };

    return (
        <div className="relative my-4 rounded-lg border border-border bg-card">
            {/* Collapsible Header */}
            <div className="flex items-center justify-between p-2 gap-1">
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        onClick={() => {
                            const newCollapsed = !collapsed;
                            hasEditedCollapsedRef.current = true;
                            setLocalCollapsed(newCollapsed);
                            if (sceneBeatId && isLoaded) saveCollapsed(newCollapsed);
                        }}
                        className="flex items-center justify-center hover:bg-accent/50 rounded-md w-6 h-6 shrink-0"
                        aria-label={collapsed ? "Expand scene beat" : "Collapse scene beat"}
                    >
                        <ChevronRight className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-90")} />
                    </button>
                    <span className="font-medium text-sm sm:text-base">Scene Beat</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {streaming && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={stopGeneration}
                            className="h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm"
                        >
                            Stop
                        </Button>
                    )}

                    <POVSettingsPopover
                        povType={povType}
                        povCharacter={povCharacter}
                        characterEntries={characterEntries}
                        onSave={handlePovSave}
                    />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8"
                        onClick={() => setShowMatchedEntries(!showMatchedEntries)}
                        title="Matched Tags"
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDelete}
                        className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive"
                        aria-label="Delete scene beat"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Collapsible Content - wait for load to prevent flash */}
            {isLoaded && !collapsed && (
                <div className="space-y-4">
                    {/* Command textarea */}
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

                    {/* Context Toggles with Custom Context Selection */}
                    <ContextToggles
                        useMatchedChapter={useMatchedChapter}
                        useMatchedSceneBeat={useMatchedSceneBeat}
                        useCustomContext={useCustomContext}
                        onMatchedChapterChange={handleMatchedChapterChange}
                        onMatchedSceneBeatChange={handleMatchedSceneBeatChange}
                        onCustomContextChange={handleCustomContextChange}
                    >
                        {useCustomContext && (
                            <LorebookMultiSelect
                                entries={entries}
                                selectedItems={selectedItems}
                                onItemSelect={handleItemSelect}
                                onItemRemove={removeItem}
                            />
                        )}
                    </ContextToggles>

                    {/* Streamed text display */}
                    {streamedText && <div className="border-t border-border p-2">{streamedText}</div>}

                    {/* Generation Controls */}
                    <GenerationControls
                        isLoading={isLoading}
                        error={promptsError}
                        prompts={prompts}
                        selectedPrompt={selectedPrompt}
                        selectedModel={selectedModel}
                        streaming={streaming}
                        streamComplete={streamComplete}
                        onPromptSelect={handlePromptSelect}
                        onPreview={handlePreviewPrompt}
                        onGenerate={handleGenerateWithPrompt}
                        onAccept={handleAccept}
                        onReject={handleReject}
                        lastUsed={lastUsed}
                    />
                </div>
            )}

            {/* Matched Entries Dialog */}
            <SceneBeatMatchedEntries
                open={showMatchedEntries}
                onOpenChange={setShowMatchedEntries}
                matchedEntries={new Set(localMatchedEntries.values())}
            />

            {/* Prompt Preview Dialog */}
            <PromptPreviewDialog
                open={showPreviewDialog}
                onOpenChange={setShowPreviewDialog}
                messages={previewMessages}
                isLoading={previewLoading}
                error={previewError}
            />

            {/* Matched Entries Panel */}
            {showMatchedEntries && (
                <MatchedEntriesPanel
                    chapterMatchedEntries={chapterMatchedEntries}
                    sceneBeatMatchedEntries={localMatchedEntries}
                    customContextEntries={selectedItems}
                    useMatchedChapter={useMatchedChapter}
                    useMatchedSceneBeat={useMatchedSceneBeat}
                    useCustomContext={useCustomContext}
                />
            )}
        </div>
    );
}

export class SceneBeatNode extends DecoratorNode<JSX.Element> {
    __sceneBeatId: string;

    constructor(sceneBeatId: string = "", key?: NodeKey) {
        super(key);
        this.__sceneBeatId = sceneBeatId;
        logger.info("🏗️ SceneBeatNode constructor:", { sceneBeatId, key });
    }

    static getType(): string {
        return "scene-beat";
    }

    static clone(node: SceneBeatNode): SceneBeatNode {
        return new SceneBeatNode(node.__sceneBeatId, node.__key);
    }

    static importJSON(serializedNode: SerializedSceneBeatNode): SceneBeatNode {
        logger.info("📥 SceneBeat importJSON:", serializedNode.sceneBeatId);
        return $createSceneBeatNode(serializedNode.sceneBeatId || "");
    }

    exportJSON(): SerializedSceneBeatNode {
        return {
            type: "scene-beat",
            version: 1,
            sceneBeatId: this.__sceneBeatId
        };
    }

    getSceneBeatId(): string {
        return this.__sceneBeatId;
    }

    setSceneBeatId(id: string): void {
        const self = this.getWritable();
        self.__sceneBeatId = id;
    }

    createDOM(): HTMLElement {
        const div = document.createElement("div");
        div.className = "scene-beat-node";
        return div;
    }

    updateDOM(): boolean {
        return false;
    }

    isInline(): boolean {
        return false;
    }

    decorate(): JSX.Element {
        return (
            <Suspense fallback={null}>
                <SceneBeatComponent nodeKey={this.__key} />
            </Suspense>
        );
    }
}

export function $createSceneBeatNode(sceneBeatId: string = ""): SceneBeatNode {
    return $applyNodeReplacement(new SceneBeatNode(sceneBeatId));
}

export function $isSceneBeatNode(node: LexicalNode | null | undefined): node is SceneBeatNode {
    return node?.getType() === "scene-beat";
}
