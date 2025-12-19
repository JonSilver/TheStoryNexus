import { mergeRegister } from "@lexical/utils";
import type { BaseSelection, LexicalCommand, LexicalEditor, NodeKey } from "lexical";
import {
    $getNodeByKey,
    $getSelection,
    $isNodeSelection,
    $isRangeSelection,
    $setSelection,
    CLICK_COMMAND,
    COMMAND_PRIORITY_LOW,
    createCommand,
    DRAGSTART_COMMAND,
    KEY_BACKSPACE_COMMAND,
    KEY_DELETE_COMMAND,
    KEY_ENTER_COMMAND,
    KEY_ESCAPE_COMMAND,
    SELECTION_CHANGE_COMMAND
} from "lexical";
import { type MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { $isImageNode } from "../ImageNode";

export const RIGHT_CLICK_IMAGE_COMMAND: LexicalCommand<MouseEvent> = createCommand("RIGHT_CLICK_IMAGE_COMMAND");

interface UseImageCommandsParams {
    editor: LexicalEditor;
    nodeKey: NodeKey;
    isSelected: boolean;
    setSelected: (selected: boolean) => void;
    clearSelection: () => void;
    isResizing: boolean;
    showCaption: boolean;
    caption: LexicalEditor;
    imageRef: MutableRefObject<HTMLImageElement | null>;
    buttonRef: MutableRefObject<HTMLButtonElement | null>;
}

export const useImageCommands = ({
    editor,
    nodeKey,
    isSelected,
    setSelected,
    clearSelection,
    isResizing,
    showCaption,
    caption,
    imageRef,
    buttonRef
}: UseImageCommandsParams) => {
    const [selection, setSelection] = useState<BaseSelection | null>(null);
    const activeEditorRef = useRef<LexicalEditor | null>(null);

    const $onDelete = useCallback(
        (payload: KeyboardEvent) => {
            const deleteSelection = $getSelection();
            if (isSelected && $isNodeSelection(deleteSelection)) {
                const event: KeyboardEvent = payload;
                event.preventDefault();
                deleteSelection.getNodes().forEach(node => {
                    if ($isImageNode(node)) node.remove();
                });
            }
            return false;
        },
        [isSelected]
    );

    const $onEnter = useCallback(
        (event: KeyboardEvent) => {
            const latestSelection = $getSelection();
            const buttonElem = buttonRef.current;
            if (isSelected && $isNodeSelection(latestSelection) && latestSelection.getNodes().length === 1)
                if (showCaption) {
                    $setSelection(null);
                    event.preventDefault();
                    caption.focus();
                    return true;
                } else if (buttonElem !== null && buttonElem !== document.activeElement) {
                    event.preventDefault();
                    buttonElem.focus();
                    return true;
                }

            return false;
        },
        [caption, isSelected, showCaption, buttonRef]
    );

    const $onEscape = useCallback(
        (event: KeyboardEvent) => {
            if (activeEditorRef.current === caption || buttonRef.current === event.target) {
                $setSelection(null);
                editor.update(() => {
                    setSelected(true);
                    const parentRootElement = editor.getRootElement();
                    if (parentRootElement !== null) parentRootElement.focus();
                });
                return true;
            }
            return false;
        },
        [caption, editor, setSelected, buttonRef]
    );

    const onClick = useCallback(
        (payload: MouseEvent) => {
            const event = payload;
            if (isResizing) return true;

            if (event.target === imageRef.current) {
                if (event.shiftKey) setSelected(!isSelected);
                else {
                    clearSelection();
                    setSelected(true);
                }
                return true;
            }

            return false;
        },
        [isResizing, isSelected, setSelected, clearSelection, imageRef]
    );

    const onRightClick = useCallback(
        (event: MouseEvent): void => {
            editor.getEditorState().read(() => {
                const latestSelection = $getSelection();
                const domElement = event.target as HTMLElement;
                if (domElement.tagName === "IMG" && $isRangeSelection(latestSelection) && latestSelection.getNodes().length === 1)
                    editor.dispatchCommand(RIGHT_CLICK_IMAGE_COMMAND, event as MouseEvent);
            });
        },
        [editor]
    );

    useEffect(() => {
        let isMounted = true;
        const rootElement = editor.getRootElement();
        const unregister = mergeRegister(
            editor.registerUpdateListener(({ editorState }) => {
                if (isMounted) setSelection(editorState.read(() => $getSelection()));
            }),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                (_, activeEditor) => {
                    activeEditorRef.current = activeEditor;
                    return false;
                },
                COMMAND_PRIORITY_LOW
            ),
            editor.registerCommand<MouseEvent>(CLICK_COMMAND, onClick, COMMAND_PRIORITY_LOW),
            editor.registerCommand<MouseEvent>(RIGHT_CLICK_IMAGE_COMMAND, onClick, COMMAND_PRIORITY_LOW),
            editor.registerCommand(
                DRAGSTART_COMMAND,
                event => {
                    if (event.target === imageRef.current) {
                        event.preventDefault();
                        return true;
                    }
                    return false;
                },
                COMMAND_PRIORITY_LOW
            ),
            editor.registerCommand(KEY_DELETE_COMMAND, $onDelete, COMMAND_PRIORITY_LOW),
            editor.registerCommand(KEY_BACKSPACE_COMMAND, $onDelete, COMMAND_PRIORITY_LOW),
            editor.registerCommand(KEY_ENTER_COMMAND, $onEnter, COMMAND_PRIORITY_LOW),
            editor.registerCommand(KEY_ESCAPE_COMMAND, $onEscape, COMMAND_PRIORITY_LOW)
        );

        rootElement?.addEventListener("contextmenu", onRightClick);

        return () => {
            isMounted = false;
            unregister();
            rootElement?.removeEventListener("contextmenu", onRightClick);
        };
    }, [editor, $onDelete, $onEnter, $onEscape, onClick, onRightClick, imageRef]);

    const setShowCaption = () => {
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if ($isImageNode(node)) node.setShowCaption(true);
        });
    };

    return { selection, setShowCaption };
};
