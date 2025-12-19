import { $isAutoLinkNode, $isLinkNode } from "@lexical/link";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
    $getSelection,
    $isLineBreakNode,
    $isRangeSelection,
    CLICK_COMMAND,
    COMMAND_PRIORITY_CRITICAL,
    COMMAND_PRIORITY_LOW,
    type LexicalEditor,
    SELECTION_CHANGE_COMMAND
} from "lexical";
import { type Dispatch, useEffect, useState } from "react";
import { getSelectedNode } from "../../utils/getSelectedNode";

interface UseFloatingLinkEditorToolbarResult {
    activeEditor: LexicalEditor;
    isLink: boolean;
    setIsLink: Dispatch<boolean>;
}

export const useFloatingLinkEditorToolbar = (editor: LexicalEditor): UseFloatingLinkEditorToolbarResult => {
    const [activeEditor, setActiveEditor] = useState(editor);
    const [isLink, setIsLink] = useState(false);

    useEffect(() => {
        const $updateToolbar = () => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                const focusNode = getSelectedNode(selection);
                const focusLinkNode = $findMatchingParent(focusNode, $isLinkNode);
                const focusAutoLinkNode = $findMatchingParent(focusNode, $isAutoLinkNode);
                if (!(focusLinkNode || focusAutoLinkNode)) {
                    setIsLink(false);
                    return;
                }
                const badNode = selection
                    .getNodes()
                    .filter(node => !$isLineBreakNode(node))
                    .find(node => {
                        const linkNode = $findMatchingParent(node, $isLinkNode);
                        const autoLinkNode = $findMatchingParent(node, $isAutoLinkNode);
                        return (
                            (focusLinkNode && !focusLinkNode.is(linkNode)) ||
                            (linkNode && !linkNode.is(focusLinkNode)) ||
                            (focusAutoLinkNode && !focusAutoLinkNode.is(autoLinkNode)) ||
                            (autoLinkNode && (!autoLinkNode.is(focusAutoLinkNode) || autoLinkNode.getIsUnlinked()))
                        );
                    });
                if (!badNode) setIsLink(true);
                else setIsLink(false);
            }
        };
        return mergeRegister(
            editor.registerUpdateListener(({ editorState }) => editorState.read(() => $updateToolbar())),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                (_payload, newEditor) => {
                    newEditor.getEditorState().read(() => $updateToolbar());
                    setActiveEditor(newEditor);
                    return false;
                },
                COMMAND_PRIORITY_CRITICAL
            ),
            editor.registerCommand(
                CLICK_COMMAND,
                payload => {
                    let result = false;
                    editor.getEditorState().read(() => {
                        const selection = $getSelection();
                        if ($isRangeSelection(selection)) {
                            const node = getSelectedNode(selection);
                            const linkNode = $findMatchingParent(node, $isLinkNode);
                            if ($isLinkNode(linkNode) && (payload.metaKey || payload.ctrlKey)) {
                                window.open(linkNode.getURL(), "_blank");
                                result = true;
                            }
                        }
                    });
                    return result;
                },
                COMMAND_PRIORITY_LOW
            )
        );
    }, [editor]);

    return { activeEditor, isLink, setIsLink };
};
