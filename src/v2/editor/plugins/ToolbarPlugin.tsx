import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $isHeadingNode } from "@lexical/rich-text";
import { mergeRegister } from "@lexical/utils";
import {
    $createParagraphNode,
    $getSelection,
    $isRangeSelection,
    CAN_REDO_COMMAND,
    CAN_UNDO_COMMAND,
    COMMAND_PRIORITY_CRITICAL,
    FORMAT_TEXT_COMMAND,
    REDO_COMMAND,
    SELECTION_CHANGE_COMMAND,
    UNDO_COMMAND
} from "lexical";
import { BookOpenText, Bold, Italic, Redo2, Sparkles, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { $createSceneBeatNode } from "../nodes/SceneBeatNode";
import type { SaveStatus } from "../useChapterSaver";
import { AiActionButtons, type ToolbarActions } from "./AiActionButtons";
import { type BlockValue, ToolbarMoreMenu } from "./ToolbarMoreMenu";

const SAVE_LABELS: Record<SaveStatus, string> = {
    idle: "",
    saving: "Saving…",
    saved: "Saved",
    failed: "Retrying…",
    conflict: "Conflict"
};

const toolButton =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground disabled:opacity-40 data-[active=true]:bg-accent data-[active=true]:text-foreground";

/**
 * One compact row: high-frequency controls only, contextual selection
 * actions, and a "…" sheet for the rest. Never scrolls horizontally.
 */
export const ToolbarPlugin = ({
    saveStatus,
    wordCount,
    storyId,
    actions,
    onToggleReference
}: {
    saveStatus: SaveStatus;
    wordCount: number;
    storyId: string;
    actions: ToolbarActions;
    onToggleReference: () => void;
}) => {
    const [editor] = useLexicalComposerContext();
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [formats, setFormats] = useState({ bold: false, italic: false });
    const [block, setBlock] = useState<BlockValue>("paragraph");
    const [hasSelection, setHasSelection] = useState(false);

    const readSelection = useCallback(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        setHasSelection(!selection.isCollapsed());
        setFormats({ bold: selection.hasFormat("bold"), italic: selection.hasFormat("italic") });
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getKey() === "root" ? anchorNode : anchorNode.getTopLevelElementOrThrow();
        setBlock($isHeadingNode(element) ? (element.getTag() as BlockValue) : "paragraph");
    }, []);

    useEffect(
        () =>
            mergeRegister(
                editor.registerCommand(
                    SELECTION_CHANGE_COMMAND,
                    () => {
                        readSelection();
                        return false;
                    },
                    COMMAND_PRIORITY_CRITICAL
                ),
                editor.registerCommand(
                    CAN_UNDO_COMMAND,
                    payload => {
                        setCanUndo(payload);
                        return false;
                    },
                    COMMAND_PRIORITY_CRITICAL
                ),
                editor.registerCommand(
                    CAN_REDO_COMMAND,
                    payload => {
                        setCanRedo(payload);
                        return false;
                    },
                    COMMAND_PRIORITY_CRITICAL
                )
            ),
        [editor, readSelection]
    );

    const insertSceneBeat = () =>
        editor.update(() => {
            const selection = $getSelection();
            if (!selection) return;
            selection.insertNodes([$createSceneBeatNode(), $createParagraphNode()]);
        });

    return (
        <div className="flex items-center gap-0.5 border-b bg-background px-1 py-1">
            <button
                type="button"
                className={toolButton}
                disabled={!canUndo}
                onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
                aria-label="Undo"
            >
                <Undo2 className="h-4 w-4" />
            </button>
            <button
                type="button"
                className={toolButton}
                disabled={!canRedo}
                onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
                aria-label="Redo"
            >
                <Redo2 className="h-4 w-4" />
            </button>
            {(
                [
                    ["bold", Bold],
                    ["italic", Italic]
                ] as const
            ).map(([format, Icon]) => (
                <button
                    key={format}
                    type="button"
                    className={toolButton}
                    data-active={formats[format]}
                    onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)}
                    aria-label={format}
                >
                    <Icon className="h-4 w-4" />
                </button>
            ))}
            {!hasSelection && (
                <button
                    type="button"
                    className={toolButton}
                    onClick={insertSceneBeat}
                    aria-label="Insert scene beat"
                    title="Insert scene beat"
                >
                    <Sparkles className="h-4 w-4" />
                </button>
            )}
            <AiActionButtons actions={actions} hasSelection={hasSelection} className={toolButton} />

            <div className="ml-auto flex shrink-0 items-center gap-0.5">
                {!hasSelection && (
                    <span className="px-1 text-xs text-muted-foreground" data-save-status={saveStatus}>
                        {wordCount.toLocaleString()}
                        {SAVE_LABELS[saveStatus] && ` · ${SAVE_LABELS[saveStatus]}`}
                    </span>
                )}
                <button
                    type="button"
                    className={toolButton}
                    onClick={onToggleReference}
                    aria-label="Reference panel"
                    title="Bible lookup & quick notes"
                >
                    <BookOpenText className="h-4 w-4" />
                </button>
                <ToolbarMoreMenu
                    editor={editor}
                    block={block}
                    storyId={storyId}
                    buttonClass={toolButton}
                    onUnderline={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
                    onSummarise={actions.onSummarise}
                />
            </div>
        </div>
    );
};
