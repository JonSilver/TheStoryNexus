import { BookOpenText, FilePlus2, NotebookPen, RefreshCw, RotateCcw } from "lucide-react";
import type { ChatMessage } from "@/types/story";
import { AttemptNav } from "../ai/AttemptNav";
import { MarkdownView } from "../components/MarkdownView";

const versionShown = (message: ChatMessage) =>
    message.versions ? Math.max(0, message.versions.lastIndexOf(message.content)) : 0;

const ACTION = "mt-1 flex items-center gap-1 text-xs text-muted-foreground";

/** One message in a brainstorm chat, with the bridges onward from an assistant reply. */
export const ChatBubble = ({
    message,
    isLast,
    onSaveNote,
    onToBible,
    onToChapter,
    onRegenerate,
    onShowVersion
}: {
    message: ChatMessage;
    isLast: boolean;
    onSaveNote: () => void;
    onToBible: () => void;
    onToChapter: () => void;
    onRegenerate: () => void;
    onShowVersion: (index: number) => void;
}) => {
    if (message.role === "user")
        return (
            <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary p-3 text-sm text-primary-foreground">
                {message.content}
            </div>
        );
    const shown = versionShown(message);
    const versions = message.versions ?? [];
    return (
        <div className="max-w-[85%] rounded-lg bg-muted p-3 text-sm">
            {message.interruptedVersions?.includes(shown) && (
                <p className="mb-1 text-xs text-muted-foreground">
                    Incomplete — cut short before the end. Regenerate for a full reply.
                </p>
            )}
            <MarkdownView>{message.content}</MarkdownView>
            <button
                type="button"
                onClick={onSaveNote}
                aria-label="Save as note"
                title="Save as note"
                className={ACTION}
            >
                <NotebookPen className="h-3.5 w-3.5" /> Save as note
            </button>
            <span className="flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={onToBible}
                    aria-label="Extract bible entries from this"
                    className={ACTION}
                >
                    <BookOpenText className="h-3.5 w-3.5" /> To bible
                </button>
                <button type="button" onClick={onToChapter} aria-label="New chapter from this" className={ACTION}>
                    <FilePlus2 className="h-3.5 w-3.5" /> To chapter
                </button>
            </span>
            {isLast && (
                <button type="button" onClick={onRegenerate} aria-label="Regenerate reply" className={ACTION}>
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </button>
            )}
            {versions.length > 1 && (
                <AttemptNav
                    label="Version"
                    index={shown}
                    count={versions.length}
                    onSelect={onShowVersion}
                    className="mt-1 flex items-center gap-1 text-xs"
                />
            )}
        </div>
    );
};

/** A conversation the server hasn't accepted yet — kept on this device until it does. */
export const UnsavedBanner = ({ onSave, onDiscard }: { onSave: () => void; onDiscard: () => void }) => (
    <div className="flex flex-wrap items-center gap-2 text-sm" role="alert">
        <p className="w-full text-destructive">
            This conversation isn't saved yet — the last write failed. It's kept on this device until it is.
        </p>
        <button type="button" onClick={onSave} className="flex items-center gap-1 rounded-md border px-3 py-1">
            <RotateCcw className="h-3.5 w-3.5" /> Save again
        </button>
        <button
            type="button"
            onClick={() =>
                window.confirm("Discard the unsaved messages and show the saved conversation?") && onDiscard()
            }
            className="rounded-md border px-3 py-1"
        >
            Discard
        </button>
    </div>
);
