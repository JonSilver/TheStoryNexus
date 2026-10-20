import { RotateCcw } from "lucide-react";
import { AttemptNav } from "../ai/AttemptNav";

/** One part of a chapter's transposition: its drafts, the one on show editable, and Try again for just this part. */
export const DraftSlot = ({
    label,
    drafts,
    index,
    shown,
    onSelect,
    onChange,
    onTryAgain,
    busy,
    minHeight = "min-h-40"
}: {
    label: string;
    drafts: string[];
    index: number;
    shown: string | null;
    onSelect: (index: number) => void;
    onChange: (text: string) => void;
    onTryAgain: () => void;
    busy: boolean;
    minHeight?: string;
}) => (
    <div className="space-y-1">
        {shown === null ? (
            <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">Not drafted yet.</p>
        ) : (
            <textarea
                aria-label={label}
                className={`${minHeight} w-full resize-y rounded-md border bg-background p-2 text-sm leading-relaxed`}
                value={shown}
                onChange={e => onChange(e.target.value)}
            />
        )}
        <div className="flex items-center gap-2">
            {drafts.length > 1 && (
                <AttemptNav
                    label="Draft"
                    index={index}
                    count={drafts.length}
                    onSelect={onSelect}
                    className="flex items-center gap-2 text-xs"
                />
            )}
            <button
                type="button"
                disabled={busy}
                onClick={onTryAgain}
                aria-label={`${drafts.length ? "Try again" : "Draft"}: ${label}`}
                className="ml-auto flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-50"
            >
                <RotateCcw className="h-3 w-3" /> {drafts.length ? "Try again" : "Draft"}
            </button>
        </div>
    </div>
);
