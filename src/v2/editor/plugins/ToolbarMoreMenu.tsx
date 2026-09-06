import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import { $createHeadingNode, type HeadingTagType } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $createParagraphNode, $getSelection, $isRangeSelection, type LexicalEditor } from "lexical";
import { FileText, List, ListOrdered, Minus, MoreHorizontal, Underline, X } from "lucide-react";
import { useState } from "react";
import { ImageUploadButton } from "./ImageUploadButton";

const BLOCK_OPTIONS = [
    { value: "paragraph", label: "Text" },
    { value: "h1", label: "Heading 1" },
    { value: "h2", label: "Heading 2" },
    { value: "h3", label: "Heading 3" }
] as const;

export type BlockValue = (typeof BLOCK_OPTIONS)[number]["value"];

const item = "flex w-full items-center gap-3 px-4 py-3 text-left text-sm";

/**
 * Overflow sheet for the lower-frequency toolbar controls — everything is
 * reachable without a horizontally scrolling toolbar.
 */
export const ToolbarMoreMenu = ({
    editor,
    block,
    storyId,
    buttonClass,
    onUnderline,
    onSummarise
}: {
    editor: LexicalEditor;
    block: BlockValue;
    storyId: string;
    buttonClass: string;
    onUnderline: () => void;
    onSummarise: () => void;
}) => {
    const [open, setOpen] = useState(false);

    const setBlockType = (value: BlockValue) =>
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            $setBlocksType(selection, () =>
                value === "paragraph" ? $createParagraphNode() : $createHeadingNode(value as HeadingTagType)
            );
        });

    const run = (action: () => void) => () => {
        action();
        setOpen(false);
    };

    return (
        <>
            <button type="button" className={buttonClass} onClick={() => setOpen(true)} aria-label="More tools">
                <MoreHorizontal className="h-4 w-4" />
            </button>
            {open && (
                <div
                    className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
                    role="dialog"
                    aria-label="More tools"
                >
                    <div className="rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]">
                        <header className="flex items-center justify-between px-4 py-3">
                            <span className="font-medium">More tools</span>
                            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                                <X className="h-4 w-4" />
                            </button>
                        </header>
                        <div className="flex items-center gap-2 px-4 pb-2">
                            <span className="text-sm text-muted-foreground">Block</span>
                            <select
                                className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
                                value={block}
                                onChange={e => {
                                    setBlockType(e.target.value as BlockValue);
                                    setOpen(false);
                                }}
                                aria-label="Block format"
                            >
                                {BLOCK_OPTIONS.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button type="button" className={item} onClick={run(onUnderline)}>
                            <Underline className="h-4 w-4" /> Underline
                        </button>
                        <button
                            type="button"
                            className={item}
                            onClick={run(() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined))}
                        >
                            <List className="h-4 w-4" /> Bullet list
                        </button>
                        <button
                            type="button"
                            className={item}
                            onClick={run(() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined))}
                        >
                            <ListOrdered className="h-4 w-4" /> Numbered list
                        </button>
                        <button
                            type="button"
                            className={item}
                            onClick={run(() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined))}
                        >
                            <Minus className="h-4 w-4" /> Divider
                        </button>
                        <div className={item}>
                            <ImageUploadButton
                                storyId={storyId}
                                className="flex items-center gap-3"
                                label="Insert image"
                                onDone={() => setOpen(false)}
                            />
                        </div>
                        <button type="button" className={item} onClick={run(onSummarise)}>
                            <FileText className="h-4 w-4" /> Summarise chapter
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
