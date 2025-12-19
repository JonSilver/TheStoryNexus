import {
    CAN_REDO_COMMAND,
    CAN_UNDO_COMMAND,
    COMMAND_PRIORITY_CRITICAL,
    FORMAT_TEXT_COMMAND,
    type LexicalEditor,
    REDO_COMMAND,
    SELECTION_CHANGE_COMMAND,
    UNDO_COMMAND
} from "lexical";
import { mergeRegister } from "@lexical/utils";
import { Bold, Italic, Maximize, Minimize, Underline } from "lucide-react";
import type { JSX } from "react";
import { type Dispatch, useEffect, useState } from "react";
import { IS_APPLE } from "@/components/story-editor/shared/environment";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context/WorkspaceContext";
import { blockTypeToBlockName, useToolbarState } from "../../context/ToolbarContext";
import { SHORTCUTS } from "../ShortcutsPlugin/shortcuts";
import { BlockFormatDropDown } from "./BlockFormatDropDown";
import { ElementFormatDropdown } from "./ElementFormatDropdown";
import { FontDropDown } from "./FontDropDown";
import FontSize from "./fontSize";
import { FormatDropdown } from "./FormatDropdown";
import { InsertDropdown } from "./InsertDropdown";
import { useToolbarUpdate } from "./useToolbarUpdate";

const Divider = (): JSX.Element => <div className="divider" />;

export default function ToolbarPlugin({
    editor,
    activeEditor,
    setActiveEditor
}: {
    editor: LexicalEditor;
    activeEditor: LexicalEditor;
    setActiveEditor: Dispatch<LexicalEditor>;
    setIsLinkEditMode: Dispatch<boolean>;
}): JSX.Element {
    const [isEditable, setIsEditable] = useState(() => editor.isEditable());
    const { toolbarState, updateToolbarState } = useToolbarState();
    const { isMaximised, toggleMaximise } = useWorkspace();
    const $updateToolbar = useToolbarUpdate(editor, activeEditor, updateToolbarState);

    useEffect(
        () =>
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                (_payload, newEditor) => {
                    setActiveEditor(newEditor);
                    newEditor.read(() => {
                        $updateToolbar();
                    });
                    return false;
                },
                COMMAND_PRIORITY_CRITICAL
            ),
        [editor, $updateToolbar, setActiveEditor]
    );

    useEffect(() => {
        activeEditor.read(() => {
            $updateToolbar();
        });
    }, [activeEditor, $updateToolbar]);

    useEffect(
        () =>
            mergeRegister(
                editor.registerEditableListener(editable => {
                    setIsEditable(editable);
                }),
                activeEditor.registerUpdateListener(() => {
                    activeEditor.read(() => {
                        $updateToolbar();
                    });
                }),
                activeEditor.registerCommand<boolean>(
                    CAN_UNDO_COMMAND,
                    payload => {
                        updateToolbarState("canUndo", payload);
                        return false;
                    },
                    COMMAND_PRIORITY_CRITICAL
                ),
                activeEditor.registerCommand<boolean>(
                    CAN_REDO_COMMAND,
                    payload => {
                        updateToolbarState("canRedo", payload);
                        return false;
                    },
                    COMMAND_PRIORITY_CRITICAL
                )
            ),
        [$updateToolbar, activeEditor, editor, updateToolbarState]
    );

    const canViewerSeeInsertDropdown = !toolbarState.isImageCaption;

    return (
        <div className="toolbar flex items-center w-full">
            <button
                disabled={!toolbarState.canUndo || !isEditable}
                onClick={() => activeEditor.dispatchCommand(UNDO_COMMAND, undefined)}
                title={IS_APPLE ? "Undo (⌘Z)" : "Undo (Ctrl+Z)"}
                type="button"
                className="toolbar-item spaced"
                aria-label="Undo"
            >
                <i className="format undo" />
            </button>
            <button
                disabled={!toolbarState.canRedo || !isEditable}
                onClick={() => activeEditor.dispatchCommand(REDO_COMMAND, undefined)}
                title={IS_APPLE ? "Redo (⇧⌘Z)" : "Redo (Ctrl+Y)"}
                type="button"
                className="toolbar-item"
                aria-label="Redo"
            >
                <i className="format redo" />
            </button>
            <Divider />
            {toolbarState.blockType in blockTypeToBlockName && activeEditor === editor && (
                <>
                    <BlockFormatDropDown
                        disabled={!isEditable}
                        blockType={toolbarState.blockType}
                        rootType={toolbarState.rootType}
                        editor={activeEditor}
                    />
                    <Divider />
                </>
            )}

            {/* Font controls - hidden on mobile */}
            <div className="hidden md:flex items-center">
                <FontDropDown
                    disabled={!isEditable}
                    style={"font-family"}
                    value={toolbarState.fontFamily}
                    editor={activeEditor}
                />
                <Divider />
                <FontSize
                    selectionFontSize={toolbarState.fontSize.slice(0, -2)}
                    editor={activeEditor}
                    disabled={!isEditable}
                />
                <Divider />
            </div>
            <Button
                disabled={!isEditable}
                onClick={() => activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
                variant="ghost"
                size="icon"
                className={`h-8 w-8 hover:bg-accent/50 transition-colors ${toolbarState.isBold ? "bg-accent/50" : ""}`}
                title={`Bold (${SHORTCUTS.BOLD})`}
                aria-label={`Format text as bold. Shortcut: ${SHORTCUTS.BOLD}`}
            >
                <Bold className="h-4 w-4" />
            </Button>
            <Button
                disabled={!isEditable}
                onClick={() => activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
                variant="ghost"
                size="icon"
                className={`h-8 w-8 hover:bg-accent/50 transition-colors ${toolbarState.isItalic ? "bg-accent/50" : ""}`}
                title={`Italic (${SHORTCUTS.ITALIC})`}
                aria-label={`Format text as italics. Shortcut: ${SHORTCUTS.ITALIC}`}
            >
                <Italic className="h-4 w-4" />
            </Button>
            <Button
                disabled={!isEditable}
                onClick={() => activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
                variant="ghost"
                size="icon"
                className={`h-8 w-8 hover:bg-accent/50 transition-colors ${toolbarState.isUnderline ? "bg-accent/50" : ""}`}
                title={`Underline (${SHORTCUTS.UNDERLINE})`}
                aria-label={`Format text to underlined. Shortcut: ${SHORTCUTS.UNDERLINE}`}
            >
                <Underline className="h-4 w-4" />
            </Button>
            <FormatDropdown editor={activeEditor} disabled={!isEditable} />
            {canViewerSeeInsertDropdown && (
                <>
                    <div className="w-[1px] h-6 bg-border mx-1" />
                    <InsertDropdown editor={editor} activeEditor={activeEditor} disabled={!isEditable} />
                </>
            )}

            {/* Alignment - hidden on mobile */}
            <div className="hidden md:flex items-center">
                <Divider />
                <ElementFormatDropdown
                    disabled={!isEditable}
                    value={toolbarState.elementFormat}
                    editor={activeEditor}
                    isRTL={toolbarState.isRTL}
                />
            </div>
            <div className="ml-auto flex items-center gap-1">
                <span className="hidden sm:inline text-xs text-muted-foreground px-2">
                    Words: {toolbarState.wordCount}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-accent/50 transition-colors"
                    onClick={toggleMaximise}
                    title={isMaximised ? "Restore layout" : "Focus mode"}
                >
                    {isMaximised ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    );
}
