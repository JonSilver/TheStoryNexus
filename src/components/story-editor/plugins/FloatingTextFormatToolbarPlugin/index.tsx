import { attemptPromise } from "@jfdi/attempt";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import is from "@sindresorhus/is";
import { $getSelection, $isRangeSelection, type LexicalEditor } from "lexical";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { PromptPreviewDialog } from "@/components/ui/prompt-preview-dialog";
import { Separator } from "@/components/ui/separator";
import { useGenerateWithPrompt } from "@/features/ai/hooks/useGenerateWithPrompt";
import { useChapterQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useLastUsedPrompt } from "@/features/prompts/hooks/useLastUsedPrompt";
import { usePromptParser } from "@/features/prompts/hooks/usePromptParser";
import { usePromptsQuery } from "@/features/prompts/hooks/usePromptsQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import { aiService } from "@/services/ai/AIService";
import type { AllowedModel, Prompt, PromptMessage } from "@/types/story";
import { logger } from "@/utils/logger";
import { FormatButtons } from "./FormatButtons";
import { GenerateButtons } from "./GenerateButtons";
import { useFloatingTextFormatToolbar } from "./useFloatingTextFormatToolbar";
import { useSelectionPromptConfig } from "./useSelectionPromptConfig";
import { useMouseDragListener, useToolbarPosition } from "./useToolbarPosition";
import "./index.css";

interface TextFormatFloatingToolbarProps {
    editor: LexicalEditor;
    anchorElem: HTMLElement;
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
}

const TextFormatFloatingToolbar = ({ editor, anchorElem, isBold, isItalic, isUnderline }: TextFormatFloatingToolbarProps): JSX.Element => {
    const popupRef = useRef<HTMLDivElement | null>(null);
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
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [previewMessages, setPreviewMessages] = useState<PromptMessage[]>();
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const { createPromptConfig, getSelectedText } = useSelectionPromptConfig({
        editor,
        currentStoryId: currentStoryId ?? undefined,
        currentChapterId: currentChapterId ?? undefined,
        storyLanguage: currentStory?.language || "English",
        povType: currentChapter?.povType || "Third Person Omniscient",
        povCharacter: currentChapter?.povCharacter || ""
    });

    useToolbarPosition(editor, anchorElem, popupRef);
    useMouseDragListener(popupRef);

    useEffect(() => {
        if (lastUsed && !selectedPrompt) {
            setSelectedPrompt(lastUsed.prompt);
            setSelectedModel(lastUsed.model);
        }
    }, [lastUsed, selectedPrompt]);

    const handlePromptSelect = (prompt: Prompt, model: AllowedModel) => {
        setSelectedPrompt(prompt);
        setSelectedModel(model);
        saveSelection(prompt, model);
    };

    const handleGenerateWithPrompt = async () => {
        if (!selectedPrompt || !selectedModel) {
            toast.error("Please select a prompt and model first");
            return;
        }

        const selectedText = getSelectedText();
        if (!selectedText) {
            toast.error("No text selected");
            return;
        }

        setIsGenerating(true);

        const [err] = await attemptPromise(async () => {
            const config = createPromptConfig(selectedPrompt);
            const response = await generateWithPrompt(config, selectedModel);
            let fullText = "";

            await aiService.handleStreamedResponse(
                response,
                token => (fullText += token),
                () => {
                    if (!fullText.trim()) {
                        toast.warning("No text returned from AI - selection preserved");
                        return;
                    }
                    editor.update(() => {
                        const currentSelection = $getSelection();
                        if ($isRangeSelection(currentSelection)) {
                            currentSelection.formatText("italic");
                            currentSelection.insertText(fullText);
                        }
                    });
                    toast.success("Text generated and inserted");
                },
                streamError => {
                    logger.error("Error streaming response:", streamError);
                    toast.error("Failed to generate text");
                }
            );
        });
        if (err) {
            logger.error("Error generating text:", err);
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
        const [err, result] = await attemptPromise(async () => parsePrompt(config));

        if (err) {
            logger.error("Error previewing prompt:", err);
            setPreviewError(is.error(err) ? err.message : "Failed to preview prompt");
        } else if (result.error) setPreviewError(result.error);
        else setPreviewMessages(result.messages);

        setPreviewLoading(false);
        setShowPreviewDialog(true);
    };

    return (
        <div ref={popupRef} className="floating-text-format-popup">
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
                        <FormatButtons editor={editor} isBold={isBold} isItalic={isItalic} isUnderline={isUnderline} />
                        <Separator orientation="vertical" className="mx-1 h-6" />
                        <GenerateButtons
                            isLoading={isLoading}
                            error={error?.message || null}
                            prompts={prompts}
                            selectedPrompt={selectedPrompt}
                            selectedModel={selectedModel}
                            onSelect={handlePromptSelect}
                            lastUsed={lastUsed}
                            isGenerating={isGenerating}
                            onPreview={handlePreviewPrompt}
                            onGenerate={handleGenerateWithPrompt}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default function FloatingTextFormatToolbarPlugin({ anchorElem = document.body }: { anchorElem?: HTMLElement }): JSX.Element | null {
    const [editor] = useLexicalComposerContext();
    const { isText, isBold, isItalic, isUnderline } = useFloatingTextFormatToolbar(editor);

    if (!isText) return null;

    return createPortal(
        <TextFormatFloatingToolbar editor={editor} anchorElem={anchorElem} isBold={isBold} isItalic={isItalic} isUnderline={isUnderline} />,
        anchorElem
    );
}
