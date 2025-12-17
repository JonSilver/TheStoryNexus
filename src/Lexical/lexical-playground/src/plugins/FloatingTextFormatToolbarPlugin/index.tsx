/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { attemptPromise } from "@jfdi/attempt";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import is from "@sindresorhus/is";
import {
    $getSelection,
    $isElementNode,
    $isParagraphNode,
    $isRangeSelection,
    $isTextNode,
    COMMAND_PRIORITY_LOW,
    FORMAT_TEXT_COMMAND,
    getDOMSelection,
    type LexicalEditor,
    type LexicalNode,
    SELECTION_CHANGE_COMMAND
} from "lexical";
import { Bold, Italic, Loader2, Underline, Wand2 } from "lucide-react";
import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { PromptPreviewDialog } from "@/components/ui/prompt-preview-dialog";
import { PromptSelectMenu } from "@/components/ui/prompt-select-menu";
import { Separator } from "@/components/ui/separator";
import { useGenerateWithPrompt } from "@/features/ai/hooks/useGenerateWithPrompt";
import { useChapterQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useLastUsedPrompt } from "@/features/prompts/hooks/useLastUsedPrompt";
import { usePromptParser } from "@/features/prompts/hooks/usePromptParser";
import { usePromptsQuery } from "@/features/prompts/hooks/usePromptsQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import { aiService } from "@/services/ai/AIService";
import type { AllowedModel, Prompt, PromptMessage, PromptParserConfig } from "@/types/story";
import { logger } from "@/utils/logger";
import { $isSceneBeatNode } from "../../nodes/SceneBeatNode";
import { getDOMRangeRect } from "../../utils/getDOMRangeRect";
import { getSelectedNode } from "../../utils/getSelectedNode";
import { setFloatingElemPosition } from "../../utils/setFloatingElemPosition";
import "./index.css";

function TextFormatFloatingToolbar({
    editor,
    anchorElem,
    isBold,
    isItalic,
    isUnderline
}: {
    editor: LexicalEditor;
    anchorElem: HTMLElement;
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
}): JSX.Element {
    const popupCharStylesEditorRef = useRef<HTMLDivElement | null>(null);
    const { currentStoryId, currentChapterId } = useStoryContext();
    const { data: prompts = [], isLoading, error } = usePromptsQuery({ includeSystem: true });
    const { lastUsed, saveSelection } = useLastUsedPrompt("selection_specific", prompts);
    const { generateWithPrompt } = useGenerateWithPrompt();
    const { parsePrompt } = usePromptParser();
    const { data: currentStory } = useStoryQuery(currentStoryId || "");
    const { data: currentChapter } = useChapterQuery(currentChapterId || "");
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | undefined>(lastUsed?.prompt);
    const [selectedModel, setSelectedModel] = useState<AllowedModel | undefined>(lastUsed?.model);
    const [isGenerating, setIsGenerating] = useState(false);

    // Pre-populate from lastUsed when it becomes available
    useEffect(() => {
        if (lastUsed && !selectedPrompt) {
            setSelectedPrompt(lastUsed.prompt);
            setSelectedModel(lastUsed.model);
        }
    }, [lastUsed, selectedPrompt]);

    // Add these states for prompt preview
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [previewMessages, setPreviewMessages] = useState<PromptMessage[]>();
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const mouseMoveListener = useCallback((e: MouseEvent) => {
        if (popupCharStylesEditorRef?.current && (e.buttons === 1 || e.buttons === 3)) 
            if (popupCharStylesEditorRef.current.style.pointerEvents !== "none") {
                const x = e.clientX;
                const y = e.clientY;
                const elementUnderMouse = document.elementFromPoint(x, y);

                if (!popupCharStylesEditorRef.current.contains(elementUnderMouse)) {
                    // Mouse is not over the target element => not a normal click, but probably a drag
                    popupCharStylesEditorRef.current.style.pointerEvents = "none";
                }
            }
        
    }, []);

    const mouseUpListener = useCallback((_e: MouseEvent) => {
        if (popupCharStylesEditorRef?.current) 
            if (popupCharStylesEditorRef.current.style.pointerEvents !== "auto") {
                popupCharStylesEditorRef.current.style.pointerEvents = "auto";
            }
        
    }, []);

    useEffect(() => {
        if (popupCharStylesEditorRef?.current) {
            document.addEventListener("mousemove", mouseMoveListener);
            document.addEventListener("mouseup", mouseUpListener);

            return () => {
                document.removeEventListener("mousemove", mouseMoveListener);
                document.removeEventListener("mouseup", mouseUpListener);
            };
        }
        return undefined;
    }, [mouseMoveListener, mouseUpListener]);

    const $updateTextFormatFloatingToolbar = useCallback(() => {
        const selection = $getSelection();

        const popupCharStylesEditorElem = popupCharStylesEditorRef.current;
        const nativeSelection = getDOMSelection(editor._window);

        if (popupCharStylesEditorElem === null) 
            return;
        

        const rootElement = editor.getRootElement();
        if (
            selection !== null &&
            nativeSelection !== null &&
            !nativeSelection.isCollapsed &&
            rootElement !== null &&
            rootElement.contains(nativeSelection.anchorNode)
        ) {
            const rangeRect = getDOMRangeRect(nativeSelection, rootElement);

            setFloatingElemPosition(rangeRect, popupCharStylesEditorElem, anchorElem);
        }
    }, [editor, anchorElem]);

    useEffect(() => {
        const scrollerElem = anchorElem.parentElement;

        const update = () => {
            editor.getEditorState().read(() => {
                $updateTextFormatFloatingToolbar();
            });
        };

        window.addEventListener("resize", update);
        if (scrollerElem) 
            scrollerElem.addEventListener("scroll", update);
        

        return () => {
            window.removeEventListener("resize", update);
            if (scrollerElem) 
                scrollerElem.removeEventListener("scroll", update);
            
        };
    }, [editor, $updateTextFormatFloatingToolbar, anchorElem]);

    useEffect(() => {
        editor.getEditorState().read(() => {
            $updateTextFormatFloatingToolbar();
        });
        return mergeRegister(
            editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => {
                    $updateTextFormatFloatingToolbar();
                });
            }),

            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    editor.getEditorState().read(() => {
                        $updateTextFormatFloatingToolbar();
                    });
                    return false;
                },
                COMMAND_PRIORITY_LOW
            )
        );
    }, [editor, $updateTextFormatFloatingToolbar]);

    const handlePromptSelect = (prompt: Prompt, model: AllowedModel) => {
        setSelectedPrompt(prompt);
        setSelectedModel(model);
        saveSelection(prompt, model);
    };

    const createPromptConfig = (prompt: Prompt): PromptParserConfig => {
        if (!currentStoryId || !currentChapterId) 
            throw new Error("No story or chapter context found");
        

        let selectedText = "";
        let previousWords = "";

        editor.getEditorState().read(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                selectedText = selection.getTextContent();

                // Get the current selection anchor and focus nodes
                const anchorNode = selection.anchor.getNode();
                const anchorOffset = selection.anchor.offset;
                const focusNode = selection.focus.getNode();
                const focusOffset = selection.focus.offset;

                // Determine if selection is backward (focus comes before anchor)
                const isBackward = selection.isBackward();

                // Get the actual start and end points of the selection
                const startNode = isBackward ? focusNode : anchorNode;
                const startOffset = isBackward ? focusOffset : anchorOffset;

                // Collect text before the selection using Lexical's node traversal
                const textParts: string[] = [];
                let reachedStartNode = false;

                // Function to traverse the editor content in document order
                const traverseNodes = (node: LexicalNode): boolean => {
                    // If we've already reached the selection start node, stop traversal
                    if (reachedStartNode) 
                        return true;
                    

                    // Skip SceneBeatNodes entirely
                    if ($isSceneBeatNode(node)) 
                        return false;
                    

                    // Check if this is the selection start node
                    if (node.is(startNode)) {
                        // If this is a text node, add text up to the selection start point
                        if ($isTextNode(node)) 
                            textParts.push(node.getTextContent().substring(0, startOffset));
                        
                        reachedStartNode = true;
                        return true;
                    }

                    // Add text content if this is a text node
                    if ($isTextNode(node)) {
                        textParts.push(node.getTextContent());
                        return false;
                    }

                    // Traverse children
                    if (!$isTextNode(node) && $isElementNode(node)) {
                        const children = node.getChildren();
                        for (const child of children) 
                            if (traverseNodes(child)) {
                                return true;
                            }
                        
                    }

                    return false;
                };

                // Start traversal from the root node
                const rootNode = editor.getEditorState()._nodeMap.get("root");
                if (rootNode) 
                    traverseNodes(rootNode);
                

                // Join all collected text
                previousWords = textParts.join("");
            }
        });

        return {
            promptId: prompt.id,
            storyId: currentStoryId,
            chapterId: currentChapterId,
            previousWords: previousWords,
            additionalContext: {
                selectedText
            },
            storyLanguage: currentStory?.language || "English",
            povType: currentChapter?.povType || "Third Person Omniscient",
            povCharacter: currentChapter?.povCharacter || ""
        };
    };

    const handleGenerateWithPrompt = async () => {
        if (!selectedPrompt || !selectedModel) {
            toast.error("Please select a prompt and model first");
            return;
        }

        let selectedText = "";

        editor.getEditorState().read(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) 
                selectedText = sel.getTextContent();
            
        });

        if (!selectedText) {
            toast.error("No text selected");
            return;
        }

        setIsGenerating(true);

        const [error] = await attemptPromise(async () => {
            const config = createPromptConfig(selectedPrompt);
            const response = await generateWithPrompt(config, selectedModel);

            let fullText = "";

            await aiService.processStreamedResponse(
                response,
                token => {
                    fullText += token;
                },
                () => {
                    // When streaming is complete, replace the selected text
                    console.log(
                        "[handleGenerateWithPrompt] onComplete called, fullText length:",
                        fullText.length,
                        "fullText:",
                        fullText.substring(0, 100)
                    );
                    editor.update(() => {
                        const currentSelection = $getSelection();
                        if ($isRangeSelection(currentSelection)) {
                            currentSelection.formatText("italic");
                            currentSelection.insertText(fullText);
                        }
                    });

                    // Reset state
                    toast.success("Text generated and inserted");
                },
                error => {
                    logger.error("Error streaming response:", error);
                    toast.error("Failed to generate text");
                }
            );
        });
        if (error) {
            logger.error("Error generating text:", error);
            toast.error("Failed to generate text");
        }
        setIsGenerating(false);
    };

    const handlePreviewPrompt = async () => {
        if (!selectedPrompt) {
            toast.error("Please select a prompt first");
            return;
        }

        setPreviewLoading(true);
        setPreviewError(null);
        setPreviewMessages(undefined);

        const config = createPromptConfig(selectedPrompt);

        const [error, result] = await attemptPromise(async () => parsePrompt(config));
        if (error) {
            logger.error("Error previewing prompt:", error);
            setPreviewError(is.error(error) ? error.message : "Failed to preview prompt");
        } else if (result.error) 
            setPreviewError(result.error);
         else 
            setPreviewMessages(result.messages);
        
        setPreviewLoading(false);
        setShowPreviewDialog(true);
    };

    return (
        <div ref={popupCharStylesEditorRef} className="floating-text-format-popup">
            {showPreviewDialog && previewMessages && (
                <PromptPreviewDialog
                    messages={previewMessages}
                    open={showPreviewDialog}
                    onOpenChange={setShowPreviewDialog}
                    isLoading={previewLoading}
                    error={previewError}
                />
            )}

            <div className="toolbar-container">
                {editor.isEditable() && (
                    <div className="toolbar-buttons">
                        <Button
                            variant={isBold ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
                            }}
                            title="Bold"
                            aria-label="Format text as bold"
                        >
                            <Bold className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={isItalic ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
                            }}
                            title="Italic"
                            aria-label="Format text as italics"
                        >
                            <Italic className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={isUnderline ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
                            }}
                            title="Underline"
                            aria-label="Format text to underlined"
                        >
                            <Underline className="h-4 w-4" />
                        </Button>

                        <Separator orientation="vertical" className="mx-1 h-6" />

                        {!isGenerating ? (
                            <>
                                <PromptSelectMenu
                                    isLoading={isLoading}
                                    error={error?.message || null}
                                    prompts={prompts}
                                    promptType="selection_specific"
                                    selectedPrompt={selectedPrompt}
                                    selectedModel={selectedModel}
                                    onSelect={handlePromptSelect}
                                    lastUsed={lastUsed}
                                />

                                {/* Add Preview Prompt button */}
                                {selectedPrompt && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handlePreviewPrompt}
                                        className="flex items-center gap-1"
                                    >
                                        Preview
                                    </Button>
                                )}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleGenerateWithPrompt}
                                    disabled={isGenerating || !selectedPrompt || !selectedModel}
                                    className="flex items-center gap-1"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="h-3 w-3" />
                                            <span>Generate</span>
                                        </>
                                    )}
                                </Button>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Generating...</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function useFloatingTextFormatToolbar(editor: LexicalEditor, anchorElem: HTMLElement): JSX.Element | null {
    const [isText, setIsText] = useState(false);
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);

    const updatePopup = useCallback(() => {
        editor.getEditorState().read(() => {
            // Should not to pop up the floating toolbar when using IME input
            if (editor.isComposing()) 
                return;
            
            const selection = $getSelection();
            const nativeSelection = getDOMSelection(editor._window);
            const rootElement = editor.getRootElement();

            if (
                nativeSelection !== null &&
                (!$isRangeSelection(selection) ||
                    rootElement === null ||
                    !rootElement.contains(nativeSelection.anchorNode))
            ) {
                setIsText(false);
                return;
            }

            if (!$isRangeSelection(selection)) 
                return;
            

            const node = getSelectedNode(selection);

            // Update text format
            setIsBold(selection.hasFormat("bold"));
            setIsItalic(selection.hasFormat("italic"));
            setIsUnderline(selection.hasFormat("underline"));

            // Simplified condition - show text formatting toolbar if there's selected text
            if (selection.getTextContent() !== "") 
                setIsText($isTextNode(node) || $isParagraphNode(node));
             else 
                setIsText(false);
            

            const rawTextContent = selection.getTextContent().replace(/\n/g, "");
            if (!selection.isCollapsed() && rawTextContent === "") {
                setIsText(false);
                return;
            }
        });
    }, [editor]);

    useEffect(() => {
        // selectionchange works on desktop but not reliably on mobile
        document.addEventListener("selectionchange", updatePopup);

        // For mobile: check selection after touch ends (with delay for selection to settle)
        const handleTouchEnd = () => {
            setTimeout(updatePopup, 100);
        };
        document.addEventListener("touchend", handleTouchEnd);

        return () => {
            document.removeEventListener("selectionchange", updatePopup);
            document.removeEventListener("touchend", handleTouchEnd);
        };
    }, [updatePopup]);

    useEffect(
        () =>
            mergeRegister(
                editor.registerUpdateListener(() => {
                    updatePopup();
                }),
                editor.registerRootListener(() => {
                    if (editor.getRootElement() === null) 
                        setIsText(false);
                    
                })
            ),
        [editor, updatePopup]
    );

    if (!isText) 
        return null;
    

    return createPortal(
        <TextFormatFloatingToolbar
            editor={editor}
            anchorElem={anchorElem}
            isBold={isBold}
            isItalic={isItalic}
            isUnderline={isUnderline}
        />,
        anchorElem
    );
}

export default function FloatingTextFormatToolbarPlugin({
    anchorElem = document.body
}: {
    anchorElem?: HTMLElement;
}): JSX.Element | null {
    const [editor] = useLexicalComposerContext();
    return useFloatingTextFormatToolbar(editor, anchorElem);
}
