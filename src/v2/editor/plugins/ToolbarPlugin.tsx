import { useCallback, useEffect, useRef, useState } from "react";
import {
    $createParagraphNode,
    $getRoot,
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
import { attemptPromise } from "@jfdi/attempt";
import { Bold, Image as ImageIcon, Italic, Minus, Redo2, Sparkles, Underline, Undo2 } from "lucide-react";
import { toast } from "react-toastify";
import { $createImageNode } from "../nodes/ImageNode";
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

export const ToolbarPlugin = ({
    saveStatus,
    wordCount,
    storyId
}: {
    saveStatus: SaveStatus;
    wordCount: number;
    storyId: string;
}) => {
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

    const uploadAndInsertImage = async (file: File) => {
        const body = new FormData();
        body.append("file", file);
        const [error, response] = await attemptPromise(() =>
            fetch(`/api/assets/${storyId}`, { method: "POST", body })
        );
        if (error || !response?.ok) {
            const detail = response ? (await response.json().catch(() => ({})))?.error : undefined;
            toast.error(detail || "Image upload failed");
            return;
        }
        const { url } = await response.json();
        editor.update(() => {
            // Focus moved to the file picker, so the editor selection is often
            // gone by now — fall back to the end of the document
            const selection = $getSelection() ?? $getRoot().selectEnd();
            selection.insertNodes([$createImageNode(url, file.name.replace(/\.[^.]+$/, "")), $createParagraphNode()]);
        });
    };

    const fileInputRef = useRef<HTMLInputElement | null>(null);

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
            <button
                type="button"
                className={toolButton}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Insert image"
            >
                <ImageIcon className="h-4 w-4" />
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
                className="hidden"
                tabIndex={-1}
                onChange={e => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void uploadAndInsertImage(file);
                }}
            />

            <div className="ml-auto flex shrink-0 items-center gap-2 pl-2 text-xs text-muted-foreground">
                <span>{wordCount} words</span>
                <span data-save-status={saveStatus}>{SAVE_LABELS[saveStatus]}</span>
            </div>
        </div>
    );
};
