import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { LexicalNestedComposer } from "@lexical/react/LexicalNestedComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { mergeRegister } from "@lexical/utils";
import type { BaseSelection, LexicalEditor, NodeKey } from "lexical";
import {
    $getSelection,
    $isNodeSelection,
    $setSelection,
    CLICK_COMMAND,
    COMMAND_PRIORITY_LOW,
    DRAGSTART_COMMAND,
    KEY_BACKSPACE_COMMAND,
    KEY_DELETE_COMMAND,
    KEY_ENTER_COMMAND,
    KEY_ESCAPE_COMMAND,
    SELECTION_CHANGE_COMMAND
} from "lexical";
import type { JSX } from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import useModal from "../../hooks/useModal";
import LinkPlugin from "../../plugins/LinkPlugin";
import ContentEditable from "../../ui/ContentEditable";
import type { Position } from "./InlineImageNode";
import { $isInlineImageNode } from "./InlineImageNode";
import "./InlineImageNode.css";
import LazyImage from "./LazyImage";
import UpdateInlineImageDialog from "./UpdateInlineImageDialog";

export default function InlineImageComponent({
    src,
    altText,
    nodeKey,
    width,
    height,
    showCaption,
    caption,
    position
}: {
    altText: string;
    caption: LexicalEditor;
    height: "inherit" | number;
    nodeKey: NodeKey;
    showCaption: boolean;
    src: string;
    width: "inherit" | number;
    position: Position;
}): JSX.Element {
    const [modal, showModal] = useModal();
    const imageRef = useRef<null | HTMLImageElement>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
    const [editor] = useLexicalComposerContext();
    const [selection, setSelection] = useState<BaseSelection | null>(null);
    const activeEditorRef = useRef<LexicalEditor | null>(null);
    const isEditable = useLexicalEditable();

    const $onDelete = useCallback(
        (payload: KeyboardEvent) => {
            const deleteSelection = $getSelection();
            if (isSelected && $isNodeSelection(deleteSelection)) {
                const event: KeyboardEvent = payload;
                event.preventDefault();
                if (isSelected && $isNodeSelection(deleteSelection))
                    deleteSelection.getNodes().forEach(node => {
                        if ($isInlineImageNode(node)) node.remove();
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
                    // Move focus into nested editor
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
        [caption, isSelected, showCaption]
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
        [caption, editor, setSelected]
    );

    useEffect(() => {
        let isMounted = true;
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
            editor.registerCommand<MouseEvent>(
                CLICK_COMMAND,
                payload => {
                    const event = payload;
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
                COMMAND_PRIORITY_LOW
            ),
            editor.registerCommand(
                DRAGSTART_COMMAND,
                event => {
                    if (event.target === imageRef.current) {
                        // TODO This is just a temporary workaround for FF to behave like other browsers.
                        // Ideally, this handles drag & drop too (and all browsers).
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
        return () => {
            isMounted = false;
            unregister();
        };
    }, [clearSelection, editor, isSelected, $onDelete, $onEnter, $onEscape, setSelected]);

    const draggable = isSelected && $isNodeSelection(selection);
    const isFocused = isSelected && isEditable;
    return (
        <Suspense fallback={null}>
            <span draggable={draggable}>
                {isEditable && (
                    <button
                        type="button"
                        className="image-edit-button"
                        ref={buttonRef}
                        onClick={() => {
                            showModal("Update Inline Image", onClose => (
                                <UpdateInlineImageDialog activeEditor={editor} nodeKey={nodeKey} onClose={onClose} />
                            ));
                        }}
                    >
                        Edit
                    </button>
                )}
                <LazyImage
                    className={isFocused ? `focused ${$isNodeSelection(selection) ? "draggable" : ""}` : null}
                    src={src}
                    altText={altText}
                    imageRef={imageRef}
                    width={width}
                    height={height}
                    position={position}
                />
            </span>
            {showCaption && (
                <span className="image-caption-container">
                    <LexicalNestedComposer initialEditor={caption}>
                        <AutoFocusPlugin />
                        <LinkPlugin />
                        <RichTextPlugin
                            contentEditable={
                                <ContentEditable
                                    placeholder="Enter a caption..."
                                    placeholderClassName="InlineImageNode__placeholder"
                                    className="InlineImageNode__contentEditable"
                                />
                            }
                            ErrorBoundary={LexicalErrorBoundary}
                        />
                    </LexicalNestedComposer>
                </span>
            )}

            {modal}
        </Suspense>
    );
}
