import { $getSelection, $isElementNode, $isRangeSelection, $isTextNode, type LexicalEditor, type LexicalNode } from "lexical";
import { useCallback } from "react";
import type { Prompt, PromptParserConfig } from "@/types/story";
import { $isSceneBeatNode } from "../../nodes/SceneBeatNode";

type PovType = "First Person" | "Third Person Limited" | "Third Person Omniscient";

interface SelectionPromptConfigParams {
    editor: LexicalEditor;
    currentStoryId: string | undefined;
    currentChapterId: string | undefined;
    storyLanguage: string;
    povType: PovType;
    povCharacter: string;
}

export const useSelectionPromptConfig = ({
    editor,
    currentStoryId,
    currentChapterId,
    storyLanguage,
    povType,
    povCharacter
}: SelectionPromptConfigParams) => {
    const createPromptConfig = useCallback(
        (prompt: Prompt): PromptParserConfig => {
            if (!currentStoryId || !currentChapterId) throw new Error("No story or chapter context found");

            let selectedText = "";
            let previousWords = "";

            editor.getEditorState().read(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    selectedText = selection.getTextContent();

                    const anchorNode = selection.anchor.getNode();
                    const anchorOffset = selection.anchor.offset;
                    const focusNode = selection.focus.getNode();
                    const focusOffset = selection.focus.offset;

                    const isBackward = selection.isBackward();
                    const startNode = isBackward ? focusNode : anchorNode;
                    const startOffset = isBackward ? focusOffset : anchorOffset;

                    const textParts: string[] = [];
                    let reachedStartNode = false;

                    const traverseNodes = (node: LexicalNode): boolean => {
                        if (reachedStartNode) return true;
                        if ($isSceneBeatNode(node)) return false;

                        if (node.is(startNode)) {
                            if ($isTextNode(node)) textParts.push(node.getTextContent().substring(0, startOffset));
                            reachedStartNode = true;
                            return true;
                        }

                        if ($isTextNode(node)) {
                            textParts.push(node.getTextContent());
                            return false;
                        }

                        if (!$isTextNode(node) && $isElementNode(node)) {
                            const children = node.getChildren();
                            for (const child of children) if (traverseNodes(child)) return true;
                        }

                        return false;
                    };

                    const rootNode = editor.getEditorState()._nodeMap.get("root");
                    if (rootNode) traverseNodes(rootNode);

                    previousWords = textParts.join("");
                }
            });

            return {
                promptId: prompt.id,
                storyId: currentStoryId,
                chapterId: currentChapterId,
                previousWords,
                additionalContext: { selectedText },
                storyLanguage,
                povType,
                povCharacter
            };
        },
        [editor, currentStoryId, currentChapterId, storyLanguage, povType, povCharacter]
    );

    const getSelectedText = useCallback((): string => {
        let selectedText = "";
        editor.getEditorState().read(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) selectedText = sel.getTextContent();
        });
        return selectedText;
    }, [editor]);

    return { createPromptConfig, getSelectedText };
};
