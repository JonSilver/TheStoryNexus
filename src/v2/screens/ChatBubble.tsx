import { BookOpenText, FilePlus2, NotebookPen, RefreshCw } from "lucide-react";
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
                    Incomplete — the model stopped partway through. Regenerate for a full reply.
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
