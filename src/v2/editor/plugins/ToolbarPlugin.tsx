import { useCallback, useEffect, useState } from "react";
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
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $isHeadingNode, type HeadingTagType } from "@lexical/rich-text";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { Bold, Italic, Minus, Redo2, Sparkles, Underline, Undo2 } from "lucide-react";
import { $createSceneBeatNode } from "../nodes/SceneBeatNode";
import type { SaveStatus } from "../useChapterSaver";

const BLOCK_OPTIONS = [
    { value: "paragraph", label: "Text" },
    { value: "h1", label: "Heading 1" },
    { value: "h2", label: "Heading 2" },
    { value: "h3", label: "Heading 3" }
] as const;

type BlockValue = (typeof BLOCK_OPTIONS)[number]["value"];

const SAVE_LABELS: Record<SaveStatus, string> = {
    idle: "",
    saving: "Saving…",
    saved: "Saved",
    failed: "Save failed — retrying",
    conflict: "Edited elsewhere"
};

const toolButton =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground disabled:opacity-40 data-[active=true]:bg-accent data-[active=true]:text-foreground";

export const ToolbarPlugin = ({ saveStatus, wordCount }: { saveStatus: SaveStatus; wordCount: number }) => {
    const [editor] = useLexicalComposerContext();
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [formats, setFormats] = useState({ bold: false, italic: false, underline: false });
    const [block, setBlock] = useState<BlockValue>("paragraph");

    const readSelection = useCallback(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        setFormats({
            bold: selection.hasFormat("bold"),
            italic: selection.hasFormat("italic"),
            underline: selection.hasFormat("underline")
        });
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

    const setBlockType = (value: BlockValue) =>
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            $setBlocksType(selection, () =>
                value === "paragraph" ? $createParagraphNode() : $createHeadingNode(value as HeadingTagType)
            );
        });

    const insertSceneBeat = () =>
        editor.update(() => {
            const selection = $getSelection();
            if (!selection) return;
            selection.insertNodes([$createSceneBeatNode(), $createParagraphNode()]);
        });

    return (
        <div className="flex items-center gap-1 overflow-x-auto border-b bg-background px-2 py-1">
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

            <select
                className="h-9 shrink-0 rounded-md border bg-background px-2 text-sm"
                value={block}
                onChange={e => setBlockType(e.target.value as BlockValue)}
                aria-label="Block format"
            >
                {BLOCK_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>

            {(
                [
                    ["bold", Bold],
                    ["italic", Italic],
                    ["underline", Underline]
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

            <button
                type="button"
                className={toolButton}
                onClick={insertSceneBeat}
                aria-label="Insert scene beat"
                title="Insert scene beat"
            >
                <Sparkles className="h-4 w-4" />
            </button>
            <button
                type="button"
                className={toolButton}
                onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)}
                aria-label="Insert horizontal rule"
            >
                <Minus className="h-4 w-4" />
            </button>

            <div className="ml-auto flex shrink-0 items-center gap-2 pl-2 text-xs text-muted-foreground">
                <span>{wordCount} words</span>
                <span data-save-status={saveStatus}>{SAVE_LABELS[saveStatus]}</span>
            </div>
        </div>
    );
};
