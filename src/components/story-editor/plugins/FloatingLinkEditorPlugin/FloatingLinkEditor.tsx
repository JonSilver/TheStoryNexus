import { $createLinkNode, $isAutoLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
    $getSelection,
    $isRangeSelection,
    type BaseSelection,
    COMMAND_PRIORITY_HIGH,
    COMMAND_PRIORITY_LOW,
    getDOMSelection,
    KEY_ESCAPE_COMMAND,
    type LexicalEditor,
    SELECTION_CHANGE_COMMAND
} from "lexical";
import { Check, Link as LinkIcon, Pencil, Trash2, X } from "lucide-react";
import type * as React from "react";
import type { JSX } from "react";
import { type Dispatch, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSelectedNode } from "../../utils/getSelectedNode";
import { setFloatingElemPositionForLinkEditor } from "../../utils/setFloatingElemPositionForLinkEditor";
import { sanitizeUrl } from "../../utils/url";

const preventDefault = (event: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLElement>): void => {
    event.preventDefault();
};

interface FloatingLinkEditorProps {
    editor: LexicalEditor;
    isLink: boolean;
    setIsLink: Dispatch<boolean>;
    anchorElem: HTMLElement;
    isLinkEditMode: boolean;
    setIsLinkEditMode: Dispatch<boolean>;
}

export const FloatingLinkEditor = ({
    editor,
    isLink,
    setIsLink,
    anchorElem,
    isLinkEditMode,
    setIsLinkEditMode
}: FloatingLinkEditorProps): JSX.Element => {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [linkUrl, setLinkUrl] = useState("");
    const [editedLinkUrl, setEditedLinkUrl] = useState("https://");
    const [lastSelection, setLastSelection] = useState<BaseSelection | null>(null);

    const $updateLinkEditor = useCallback(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            const node = getSelectedNode(selection);
            const linkParent = $findMatchingParent(node, $isLinkNode);

            if (linkParent) setLinkUrl(linkParent.getURL());
            else if ($isLinkNode(node)) setLinkUrl(node.getURL());
            else setLinkUrl("");

            if (isLinkEditMode) setEditedLinkUrl(linkUrl);
        }
        const editorElem = editorRef.current;
        const nativeSelection = getDOMSelection(editor._window);
        const activeElement = document.activeElement;

        if (editorElem === null) return true;

        const rootElement = editor.getRootElement();

        if (
            selection !== null &&
            nativeSelection !== null &&
            rootElement !== null &&
            rootElement.contains(nativeSelection.anchorNode) &&
            editor.isEditable()
        ) {
            const domRect: DOMRect | undefined = nativeSelection.focusNode?.parentElement?.getBoundingClientRect();
            if (domRect) {
                domRect.y += 40;
                setFloatingElemPositionForLinkEditor(domRect, editorElem, anchorElem);
            }
            setLastSelection(selection);
        } else if (!activeElement || activeElement.className !== "link-input") {
            if (rootElement !== null) setFloatingElemPositionForLinkEditor(null, editorElem, anchorElem);

            setLastSelection(null);
            setIsLinkEditMode(false);
            setLinkUrl("");
        }

        return true;
    }, [anchorElem, editor, setIsLinkEditMode, isLinkEditMode, linkUrl]);

    useEffect(() => {
        const scrollerElem = anchorElem.parentElement;
        const update = () => editor.getEditorState().read(() => $updateLinkEditor());

        window.addEventListener("resize", update);
        if (scrollerElem) scrollerElem.addEventListener("scroll", update);

        return () => {
            window.removeEventListener("resize", update);
            if (scrollerElem) scrollerElem.removeEventListener("scroll", update);
        };
    }, [anchorElem.parentElement, editor, $updateLinkEditor]);

    useEffect(
        () =>
            mergeRegister(
                editor.registerUpdateListener(({ editorState }) => editorState.read(() => $updateLinkEditor())),
                editor.registerCommand(
                    SELECTION_CHANGE_COMMAND,
                    () => {
                        editor.getEditorState().read(() => $updateLinkEditor());
                        return true;
                    },
                    COMMAND_PRIORITY_LOW
                ),
                editor.registerCommand(
                    KEY_ESCAPE_COMMAND,
                    () => {
                        if (isLink) {
                            setIsLink(false);
                            return true;
                        }
                        return false;
                    },
                    COMMAND_PRIORITY_HIGH
                )
            ),
        [editor, $updateLinkEditor, setIsLink, isLink]
    );

    useEffect(() => {
        editor.getEditorState().read(() => $updateLinkEditor());
    }, [editor, $updateLinkEditor]);

    useEffect(() => {
        if (isLinkEditMode && inputRef.current) inputRef.current.focus();
    }, [isLinkEditMode]);

    const monitorInputInteraction = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") handleLinkSubmission(event);
        else if (event.key === "Escape") {
            event.preventDefault();
            setIsLinkEditMode(false);
        }
    };

    const handleLinkSubmission = (event: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        if (lastSelection !== null) {
            if (linkUrl !== "")
                editor.update(() => {
                    editor.dispatchCommand(TOGGLE_LINK_COMMAND, sanitizeUrl(editedLinkUrl));
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        const parent = getSelectedNode(selection).getParent();
                        if ($isAutoLinkNode(parent)) {
                            const linkNode = $createLinkNode(parent.getURL(), {
                                rel: parent.__rel,
                                target: parent.__target,
                                title: parent.__title
                            });
                            parent.replace(linkNode, true);
                        }
                    }
                });

            setEditedLinkUrl("https://");
            setIsLinkEditMode(false);
        }
    };

    return (
        <div ref={editorRef} className="link-editor">
            {!isLink ? null : isLinkEditMode ? (
                <div className="flex items-center gap-2 bg-background border border-border rounded-md p-2">
                    <Input
                        ref={inputRef}
                        className="h-8 min-w-[200px]"
                        value={editedLinkUrl}
                        onChange={event => setEditedLinkUrl(event.target.value)}
                        onKeyDown={event => monitorInputInteraction(event)}
                    />
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onMouseDown={preventDefault} onClick={() => setIsLinkEditMode(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onMouseDown={preventDefault} onClick={handleLinkSubmission}>
                            <Check className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 bg-background border border-border rounded-md p-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <a
                        href={sanitizeUrl(linkUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-foreground hover:text-primary truncate max-w-[200px]"
                    >
                        {linkUrl}
                    </a>
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onMouseDown={preventDefault}
                            onClick={event => {
                                event.preventDefault();
                                setEditedLinkUrl(linkUrl);
                                setIsLinkEditMode(true);
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onMouseDown={preventDefault}
                            onClick={() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
